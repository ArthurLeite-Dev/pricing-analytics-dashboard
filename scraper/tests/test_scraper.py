# Testes da lógica de negócio do scraper — parsing de preço/nome, cálculo
# de variação e gravação no Firestore. Fora do escopo aqui, de propósito:
# fetch_html (rede real), init_firebase (credenciais reais) e a
# orquestração de run_batch/run_single/main — essas dependem de I/O externo
# e ficam melhor cobertas por um teste manual/de integração do que por um
# teste unitário com tudo mockado.
#
# Rodar (a partir da pasta scraper/):
#   pip install -r requirements.txt -r requirements-dev.txt --break-system-packages
#   pytest -v

from __future__ import annotations

import datetime

import pytest
from bs4 import BeautifulSoup

import scraper

NOW = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)


# ---------------------------------------------------------------------------
# Fakes mínimos do Firestore (Admin SDK Python), só com o que save_result e
# maybe_create_alert realmente usam: collection().document(id).get()/.set(),
# subcoleção priceHistory, e collection("alerts").add(). Não é um substituto
# do SDK real — só o suficiente para testar a lógica sem rede/credenciais.
# ---------------------------------------------------------------------------


class FakeSnapshot:
    def __init__(self, data):
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data


class FakePriceHistory:
    def __init__(self):
        self.entries = []

    def add(self, data):
        self.entries.append(data)


class FakeDocRef:
    def __init__(self, docs_store, doc_id, price_history):
        self._docs_store = docs_store
        self.doc_id = doc_id
        self.price_history = price_history

    def get(self):
        return FakeSnapshot(self._docs_store.get(self.doc_id))

    def set(self, data, merge=False):
        existing = self._docs_store.get(self.doc_id)
        if merge and existing:
            self._docs_store[self.doc_id] = {**existing, **data}
        else:
            self._docs_store[self.doc_id] = dict(data)

    def collection(self, name):
        assert name == "priceHistory", f"subcoleção inesperada: {name}"
        return self.price_history


class FakeProductsCollection:
    def __init__(self, initial_docs=None):
        self.docs = dict(initial_docs or {})
        self._refs = {}
        self._price_histories = {}

    def document(self, doc_id):
        if doc_id not in self._refs:
            self._price_histories[doc_id] = FakePriceHistory()
            self._refs[doc_id] = FakeDocRef(self.docs, doc_id, self._price_histories[doc_id])
        return self._refs[doc_id]

    def price_history_for(self, doc_id):
        return self._price_histories.get(doc_id, FakePriceHistory()).entries


class FakeAlertsCollection:
    def __init__(self):
        self.added = []

    def add(self, data):
        self.added.append(data)


class FakeDb:
    """Substitui o client do firebase_admin.firestore nos testes."""

    def __init__(self, existing_products=None):
        self.products = FakeProductsCollection(existing_products)
        self.alerts = FakeAlertsCollection()

    def collection(self, name):
        if name == "products":
            return self.products
        if name == "alerts":
            return self.alerts
        raise ValueError(f"coleção inesperada nos testes: {name}")


def make_result(**overrides) -> scraper.ScrapeResult:
    """Fábrica de ScrapeResult com defaults sensatos — só passe o que o
    teste precisa sobrescrever."""
    defaults = dict(
        product_id="p1",
        url="https://loja.com/produto/1",
        name=None,
        image=None,
        store="Loja",
        price=None,
        currency="BRL",
        scraped_at=NOW,
        scrape_status="ok",
    )
    defaults.update(overrides)
    return scraper.ScrapeResult(**defaults)


# ---------------------------------------------------------------------------
# _to_float / _plain_price_to_float
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("R$ 1.234,56", 1234.56),
        ("1234,56", 1234.56),
        ("R$\xa0199,90", 199.90),
        ("42", 42.0),
        ("1.234", 1234.0),  # ponto = separador de milhar (BR), não decimal
        (None, None),
        ("", None),
        ("indisponível", None),
    ],
)
def test_to_float(raw, expected):
    assert scraper._to_float(raw) == expected


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("239.99", 239.99),
        (239.99, 239.99),
        ("1999", 1999.0),
        (None, None),
        ("indisponível", None),
    ],
)
def test_plain_price_to_float(raw, expected):
    assert scraper._plain_price_to_float(raw) == expected


def test_to_float_and_plain_price_to_float_disagree_on_purpose():
    """Documenta por que as duas funções existem: o mesmo texto "239.99"
    significa coisas diferentes dependendo de quem escreveu — JSON-LD/meta
    (ponto decimal) vs texto BR visível (ponto de milhar). Se algum dia
    isso convergir, é sinal de que uma delas foi usada na fonte errada."""
    assert scraper._plain_price_to_float("239.99") == 239.99
    assert scraper._to_float("239.99") == 23999.0


# ---------------------------------------------------------------------------
# clean_product_name
# ---------------------------------------------------------------------------


def test_clean_product_name_none_and_empty_passthrough():
    assert scraper.clean_product_name(None) is None
    assert scraper.clean_product_name("") == ""


def test_clean_product_name_strips_sku_suffix():
    raw = "Placa de Vídeo RTX 4070 Super 12GB - RTX4070S-O12G-BLACK"
    assert scraper.clean_product_name(raw) == "Placa de Vídeo RTX 4070 Super 12GB"


def test_clean_product_name_short_name_unchanged():
    assert scraper.clean_product_name("Mouse Gamer") == "Mouse Gamer"


def test_clean_product_name_truncates_at_comma_or_space():
    raw = "Monitor Gamer Curvo 27 Polegadas 165Hz, Painel VA, HDMI e DisplayPort, Preto"
    result = scraper.clean_product_name(raw)
    assert len(result) <= scraper.MAX_NAME_LENGTH
    assert not result.endswith(",")
    assert not result.endswith(" ")
    assert raw.startswith(result)


def test_clean_product_name_hard_truncate_when_no_good_cut_point():
    raw = "X" * 70  # uma única "palavra", sem espaço/vírgula para cortar
    result = scraper.clean_product_name(raw)
    assert result == "X" * scraper.MAX_NAME_LENGTH


# ---------------------------------------------------------------------------
# derive_store_name
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url, expected",
    [
        ("https://www.amazon.com.br/dp/xyz", "Amazon"),
        ("https://kabum.com.br/produto/123", "Kabum"),
        ("https://loja.magazineluiza.com.br/item", "Loja"),
    ],
)
def test_derive_store_name(url, expected):
    assert scraper.derive_store_name(url) == expected


def test_derive_store_name_fallback_for_malformed_url():
    assert scraper.derive_store_name("isso não é uma url") == "Loja"


# ---------------------------------------------------------------------------
# _extract_price_from_jsonld — estruturas de dado puras, sem HTML
# ---------------------------------------------------------------------------


def test_extract_price_from_jsonld_offers_dict():
    data = {"@type": "Product", "offers": {"@type": "Offer", "price": "1299.90"}}
    assert scraper._extract_price_from_jsonld(data) == 1299.90


def test_extract_price_from_jsonld_offers_list_uses_first():
    data = {"offers": [{"price": "99.90"}, {"price": "199.90"}]}
    assert scraper._extract_price_from_jsonld(data) == 99.90


def test_extract_price_from_jsonld_graph_wrapper():
    data = {"@graph": [{"@type": "WebPage"}, {"@type": "Product", "offers": {"price": "55.00"}}]}
    assert scraper._extract_price_from_jsonld(data) == 55.00


def test_extract_price_from_jsonld_top_level_price_field():
    data = {"@type": "Offer", "price": "42.50"}
    assert scraper._extract_price_from_jsonld(data) == 42.50


def test_extract_price_from_jsonld_missing_price_returns_none():
    assert scraper._extract_price_from_jsonld({"@type": "Product"}) is None
    assert scraper._extract_price_from_jsonld([{"@type": "Product"}]) is None
    assert scraper._extract_price_from_jsonld("não é um dict nem lista") is None


# ---------------------------------------------------------------------------
# parse_price — end-to-end via HTML real, cobrindo a ordem de precedência
# JSON-LD > meta > CSS e o fix do bug de formato BR vs. numérico puro.
# ---------------------------------------------------------------------------


def soup_of(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def test_parse_price_prefers_jsonld_over_meta_tag():
    html = """
    <html><head>
      <script type="application/ld+json">
      {"@type": "Product", "offers": {"@type": "Offer", "price": "1299.90"}}
      </script>
      <meta property="product:price:amount" content="999.00">
    </head></html>
    """
    assert scraper.parse_price(soup_of(html)) == 1299.90


def test_parse_price_meta_tag_is_plain_decimal_not_br_format():
    """Antes do fix, meta[product:price:amount]="149.90" virava 14990.0
    (o "." era tratado como separador de milhar BR). O conteúdo desse meta
    é sempre numérico puro — mesma convenção do JSON-LD."""
    html = """
    <html><head>
      <meta property="product:price:amount" content="149.90">
    </head></html>
    """
    assert scraper.parse_price(soup_of(html)) == 149.90


def test_parse_price_css_content_attribute_is_plain_decimal():
    """Padrão comum de schema.org Microdata: o texto visível é BR, mas o
    atributo content= (lido por máquina) é numérico puro."""
    html = """
    <html><body>
      <span itemprop="price" content="1999.00">R$ 1.999,00</span>
    </body></html>
    """
    assert scraper.parse_price(soup_of(html)) == 1999.00


def test_parse_price_css_data_price_still_uses_br_format():
    """data-price não é um atributo padronizado entre lojas — continua
    passando pelo parser BR, como antes do fix."""
    html = """
    <html><body>
      <div class="price-box" data-price="1.999,00">R$ 1.999,00</div>
    </body></html>
    """
    assert scraper.parse_price(soup_of(html)) == 1999.00


def test_parse_price_css_visible_text_uses_br_format():
    html = """
    <html><body>
      <span class="price-value">R$ 259,00</span>
    </body></html>
    """
    assert scraper.parse_price(soup_of(html)) == 259.00


def test_parse_price_ignores_old_price_class():
    html = """
    <html><body>
      <span class="price-old">R$ 399,00</span>
      <span class="price-current">R$ 259,00</span>
    </body></html>
    """
    assert scraper.parse_price(soup_of(html)) == 259.00


def test_parse_price_returns_none_when_nothing_matches():
    html = "<html><body><p>Produto sem preço estruturado.</p></body></html>"
    assert scraper.parse_price(soup_of(html)) is None


# ---------------------------------------------------------------------------
# parse_product_info
# ---------------------------------------------------------------------------


def test_parse_product_info_uses_og_tags_and_cleans_name():
    html = """
    <html><head>
      <meta property="og:title" content="Monitor Gamer 27 Polegadas 165Hz - MON27165HZ">
      <meta property="og:image" content="https://loja.com/img/monitor.jpg">
    </head></html>
    """
    name, image = scraper.parse_product_info(soup_of(html))
    assert name == "Monitor Gamer 27 Polegadas 165Hz"
    assert image == "https://loja.com/img/monitor.jpg"


def test_parse_product_info_falls_back_to_title_tag_when_no_og_title():
    html = "<html><head><title>  Fallback Page Title  </title></head></html>"
    name, image = scraper.parse_product_info(soup_of(html))
    assert name == "Fallback Page Title"
    assert image is None


# ---------------------------------------------------------------------------
# classify_change
# ---------------------------------------------------------------------------


def test_classify_change_queda():
    assert scraper.classify_change(100.0, 90.0) == (-10.0, "queda")


def test_classify_change_aumento():
    assert scraper.classify_change(100.0, 110.0) == (10.0, "aumento")


def test_classify_change_estavel_within_threshold():
    change_pct, status = scraper.classify_change(100.0, 100.5)
    assert status == "estavel"
    assert change_pct == pytest.approx(0.5)


def test_classify_change_no_previous_price():
    assert scraper.classify_change(None, 100.0) == (None, "estavel")


def test_classify_change_previous_price_zero():
    assert scraper.classify_change(0.0, 100.0) == (None, "estavel")


@pytest.mark.parametrize(
    "previous, new, expected",
    [
        (100.0, 99.0, (-1.0, "queda")),  # exatamente -1% (limite inclusivo)
        (100.0, 101.0, (1.0, "aumento")),  # exatamente +1% (limite inclusivo)
    ],
)
def test_classify_change_exact_threshold_boundaries(previous, new, expected):
    assert scraper.classify_change(previous, new) == expected


# ---------------------------------------------------------------------------
# maybe_create_alert
# ---------------------------------------------------------------------------


def test_maybe_create_alert_crossed_below_creates_queda_alert():
    db = FakeDb()
    scraper.maybe_create_alert(
        db, "p1", "Produto X", "Loja X", target_price=900.0, previous_price=1000.0, new_price=850.0
    )
    assert len(db.alerts.added) == 1
    alert = db.alerts.added[0]
    assert alert["type"] == "queda"
    assert alert["target"] == 900.0
    assert alert["current"] == 850.0
    assert alert["productId"] == "p1"
    assert alert["read"] is False


def test_maybe_create_alert_crossed_above_creates_aumento_alert():
    db = FakeDb()
    scraper.maybe_create_alert(
        db, "p1", "Produto X", "Loja X", target_price=900.0, previous_price=800.0, new_price=950.0
    )
    assert len(db.alerts.added) == 1
    assert db.alerts.added[0]["type"] == "aumento"


def test_maybe_create_alert_no_cross_does_nothing():
    db = FakeDb()
    # preço sobe de 800 pra 850, mas o alvo (900) nunca foi cruzado
    scraper.maybe_create_alert(
        db, "p1", "Produto X", "Loja X", target_price=900.0, previous_price=800.0, new_price=850.0
    )
    assert db.alerts.added == []


@pytest.mark.parametrize(
    "target_price, previous_price",
    [(None, 100.0), (900.0, None)],
)
def test_maybe_create_alert_missing_target_or_previous_does_nothing(target_price, previous_price):
    db = FakeDb()
    scraper.maybe_create_alert(
        db, "p1", "Produto X", "Loja X", target_price=target_price, previous_price=previous_price, new_price=850.0
    )
    assert db.alerts.added == []


# ---------------------------------------------------------------------------
# save_result
# ---------------------------------------------------------------------------


def test_save_result_new_product_sets_created_at_and_history_but_no_alert():
    db = FakeDb()
    result = make_result(
        product_id="p1", name="Produto Novo", image="https://img/x.jpg", store="Loja", price=199.90
    )
    scraper.save_result(db, result, target_price=250.0)

    stored = db.products.docs["p1"]
    assert stored["name"] == "Produto Novo"
    assert stored["image"] == "https://img/x.jpg"
    assert stored["scrapeStatus"] == "ok"
    assert stored["targetPrice"] == 250.0
    assert stored["previousPrice"] is None
    assert stored["currentPrice"] == 199.90
    assert stored["status"] == "estavel"
    assert "createdAt" in stored

    assert len(db.products.price_history_for("p1")) == 1
    assert db.products.price_history_for("p1")[0]["price"] == 199.90
    # primeira coleta não tem preço anterior pra comparar -> sem alerta
    assert db.alerts.added == []


def test_save_result_existing_product_preserves_store_and_name_and_creates_alert():
    db = FakeDb(
        existing_products={
            "p2": {
                "store": "Loja Antiga",
                "name": "Nome Antigo",
                "currentPrice": 100.0,
                "targetPrice": 90.0,
                "status": "estavel",
            }
        }
    )
    # store "derivada" nesta coleta viria diferente da já salva — a salva
    # deve prevalecer (não fica trocando de nome de loja a cada coleta)
    result = make_result(product_id="p2", name=None, image=None, store="Nome Derivado Da Url", price=85.0)
    scraper.save_result(db, result)

    stored = db.products.docs["p2"]
    assert stored["store"] == "Loja Antiga"
    assert stored["name"] == "Nome Antigo"  # preservado via merge (result.name era None)
    assert stored["currentPrice"] == 85.0
    assert stored["previousPrice"] == 100.0
    assert stored["changePct"] == -15.0
    assert stored["status"] == "queda"
    assert stored["targetPrice"] == 90.0  # veio de existing, já que não passamos o parâmetro

    assert len(db.alerts.added) == 1
    alert = db.alerts.added[0]
    assert alert["product"] == "Nome Antigo"
    assert alert["store"] == "Loja Antiga"
    assert alert["type"] == "queda"


def test_save_result_failed_scrape_preserves_last_known_price():
    """Uma coleta que falha (error/not_found) só deve atualizar
    scrapeStatus — o último preço bom conhecido não pode ser apagado."""
    db = FakeDb(
        existing_products={
            "p3": {"store": "Loja X", "name": "Produto X", "currentPrice": 50.0, "targetPrice": 40.0, "status": "estavel"}
        }
    )
    result = make_result(product_id="p3", store="Loja X", price=None, scrape_status="error")
    scraper.save_result(db, result)

    stored = db.products.docs["p3"]
    assert stored["scrapeStatus"] == "error"
    assert stored["currentPrice"] == 50.0  # inalterado
    assert stored["status"] == "estavel"  # inalterado
    assert db.products.price_history_for("p3") == []
    assert db.alerts.added == []


def test_save_result_explicit_target_price_overrides_existing():
    db = FakeDb(existing_products={"p4": {"store": "Loja Y", "currentPrice": 200.0, "targetPrice": 500.0}})
    result = make_result(product_id="p4", store="Loja Y", price=195.0)
    scraper.save_result(db, result, target_price=300.0)

    assert db.products.docs["p4"]["targetPrice"] == 300.0
