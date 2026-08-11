"""
scraper.py — Coleta preços dos produtos monitorados e grava no Firestore.

Fluxo:
    1. Lê os produtos da coleção `products` no Firestore (ou recebe uma
       única URL avulsa via --url, usado pela API Node quando um link novo
       é cadastrado pelo modal do front-end).
    2. Faz o request HTTP e extrai preço, nome e imagem de cada página.
    3. Compara com o preço anterior salvo, calcula a variação (changePct)
       e o status ("queda" | "estavel" | "aumento").
    4. Grava o produto atualizado + um novo ponto em priceHistory.
    5. Se o preço cruzar o `targetPrice` definido pelo usuário, cria um
       documento em `alerts`.

Requisitos:
    pip install requests beautifulsoup4 pandas firebase-admin --break-system-packages

Uso:
    python scraper.py                              # coleta todos os produtos
    python scraper.py --url https://loja.com/p/123  # coleta avulsa (sem doc ainda)
    python scraper.py --product-id abc123           # recoleta um produto específico

Boas práticas: respeite o robots.txt e os termos de uso de cada loja, e
ajuste REQUEST_DELAY_SECONDS para não sobrecarregar o site de origem.
"""

from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import firebase_admin
import pandas as pd
import requests
from bs4 import BeautifulSoup
from firebase_admin import credentials, firestore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scraper")

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; PriceWatchBot/1.0)"}
REQUEST_TIMEOUT = 15
REQUEST_DELAY_SECONDS = 2  # intervalo entre requisições ao rodar em lote

# Variação mínima (%) para considerar o preço "em queda" ou "em aumento";
# abaixo disso o produto é classificado como "estavel". Ajuste conforme
# a sensibilidade desejada (também pode virar uma configuração por usuário
# futuramente, ligada à tela /configuracoes).
CHANGE_THRESHOLD_PCT = 1.0

# Caminho padrão da service account, ancorado na pasta ONDE ESTÁ o próprio
# scraper.py — não no diretório de onde o processo foi iniciado. Isso é
# importante porque a API Node roda este script via spawn() a partir da
# pasta /backend, então um caminho relativo simples ("serviceAccountKey.json")
# procuraria (errado) dentro de /backend em vez de /scraper.
DEFAULT_CRED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "serviceAccountKey.json")


@dataclass
class ScrapeResult:
    product_id: str
    url: str
    name: Optional[str]
    image: Optional[str]
    store: str
    price: Optional[float]
    currency: str
    scraped_at: datetime.datetime
    scrape_status: str  # "ok" | "error" | "not_found"


def init_firebase(cred_path: str = "serviceAccountKey.json"):
    """Inicializa o Admin SDK. Baixe a chave em:
    Console Firebase > Configurações do projeto > Contas de serviço > Gerar nova chave privada.
    """
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()


def derive_store_name(url: str) -> str:
    """Heurística simples: usa o domínio como nome da loja (ex: 'amazon.com.br' -> 'Amazon')."""
    netloc = urlparse(url).netloc.lower().removeprefix("www.")
    main = netloc.split(".")[0] if netloc else "Loja"
    return main.capitalize() or "Loja"


def fetch_html(url: str) -> Optional[str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        logger.error("Falha ao buscar %s: %s", url, exc)
        return None


def _to_float(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    cleaned = (
        raw.strip()
        .replace("R$", "")
        .replace("\xa0", "")
        .replace(".", "")  # separador de milhar (padrão BR)
        .replace(",", ".")  # separador decimal (padrão BR)
        .strip()
    )
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_price(soup: BeautifulSoup) -> Optional[float]:
    """
    Extrai o preço da página, tentando nesta ordem:
    1) JSON-LD (dado estruturado padrão schema.org — o mais confiável,
       muito usado por lojas Next.js/React para SEO, ex: KaBuM!, Magalu)
    2) meta tags de e-commerce (Open Graph / schema.org)
    3) seletores CSS genéricos (fallback, quando nada acima existe)

    IMPORTANTE: os seletores CSS do passo 3 são um PONTO DE PARTIDA
    genérico. Cada loja estrutura o HTML de um jeito, então inspecione o
    DOM real de cada site-alvo (botão direito > Inspecionar) e
    ajuste/adicione seletores específicos quando o valor não for
    encontrado corretamente.
    """
    price = _price_from_jsonld(soup)
    if price is not None:
        return price

    meta_price = soup.find("meta", attrs={"property": "product:price:amount"}) or soup.find(
        "meta", attrs={"itemprop": "price"}
    )
    if meta_price and meta_price.get("content"):
        value = _to_float(meta_price["content"])
        if value is not None:
            return value

    candidates = soup.select(
        "[class*='price']:not([class*='old']):not([class*='original']), "
        "[itemprop='price'], [data-price]"
    )
    for el in candidates:
        text = el.get("content") or el.get("data-price") or el.get_text()
        value = _to_float(text)
        if value is not None:
            return value

    return None


def _price_from_jsonld(soup: BeautifulSoup) -> Optional[float]:
    """Procura um bloco <script type="application/ld+json"> com schema.org
    Product/Offer e extrai o preço de dentro dele."""
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        price = _extract_price_from_jsonld(data)
        if price is not None:
            return price
    return None


def _extract_price_from_jsonld(data) -> Optional[float]:
    if isinstance(data, list):
        for item in data:
            price = _extract_price_from_jsonld(item)
            if price is not None:
                return price
        return None

    if not isinstance(data, dict):
        return None

    if "@graph" in data:
        price = _extract_price_from_jsonld(data["@graph"])
        if price is not None:
            return price

    offers = data.get("offers")
    if isinstance(offers, list):
        offers = offers[0] if offers else None
    if isinstance(offers, dict):
        raw = offers.get("price") or offers.get("lowPrice")
        if raw is not None:
            return _jsonld_price_to_float(raw)

    if "price" in data:
        return _jsonld_price_to_float(data["price"])

    return None


def _jsonld_price_to_float(raw) -> Optional[float]:
    """Preços em JSON-LD já vêm em formato numérico puro (schema.org),
    ex: "239.99" — ao contrário do formato brasileiro visível na página
    (239,99), por isso NÃO usa o mesmo parser de _to_float."""
    if raw is None:
        return None
    try:
        return float(str(raw).strip())
    except ValueError:
        return None


def parse_product_info(soup: BeautifulSoup) -> tuple[Optional[str], Optional[str]]:
    """Extrai nome (og:title/<title>) e imagem (og:image) da página, quando existirem."""
    name = None
    og_title = soup.find("meta", attrs={"property": "og:title"})
    if og_title and og_title.get("content"):
        name = og_title["content"].strip()
    elif soup.title and soup.title.string:
        name = soup.title.string.strip()

    image = None
    og_image = soup.find("meta", attrs={"property": "og:image"})
    if og_image and og_image.get("content"):
        image = og_image["content"].strip()

    return name, image


def scrape_url(product_id: str, url: str) -> ScrapeResult:
    html = fetch_html(url)
    now = datetime.datetime.now(datetime.timezone.utc)

    if html is None:
        return ScrapeResult(product_id, url, None, None, derive_store_name(url), None, "BRL", now, "error")

    soup = BeautifulSoup(html, "html.parser")
    price = parse_price(soup)
    name, image = parse_product_info(soup)
    status = "ok" if price is not None else "not_found"

    return ScrapeResult(
        product_id, url, name, image, derive_store_name(url), price, "BRL", now, status
    )


def classify_change(previous_price: Optional[float], new_price: float) -> tuple[Optional[float], str]:
    if previous_price is None or previous_price == 0:
        return None, "estavel"

    change_pct = ((new_price - previous_price) / previous_price) * 100
    if change_pct <= -CHANGE_THRESHOLD_PCT:
        return round(change_pct, 2), "queda"
    if change_pct >= CHANGE_THRESHOLD_PCT:
        return round(change_pct, 2), "aumento"
    return round(change_pct, 2), "estavel"


def maybe_create_alert(db, product_id: str, product_name: str, store: str,
                        target_price: Optional[float], previous_price: Optional[float], new_price: float):
    """Cria um alerta somente no momento em que o preço CRUZA o alvo
    (evita disparar um alerta novo a cada coleta enquanto o preço
    permanece do mesmo lado do alvo)."""
    if target_price is None or previous_price is None:
        return

    crossed_below = previous_price > target_price >= new_price
    crossed_above = previous_price <= target_price < new_price

    if not crossed_below and not crossed_above:
        return

    db.collection("alerts").add(
        {
            "productId": product_id,
            "product": product_name,
            "store": store,
            "target": target_price,
            "current": new_price,
            "type": "queda" if crossed_below else "aumento",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "read": False,
        }
    )
    logger.info("Alerta criado para produto %s (%s)", product_id, "queda" if crossed_below else "aumento")


def save_result(db, result: ScrapeResult, target_price: Optional[float] = None):
    product_ref = db.collection("products").document(result.product_id)
    snapshot = product_ref.get()
    existing = snapshot.to_dict() if snapshot.exists else {}

    previous_price = existing.get("currentPrice")
    target_price = target_price if target_price is not None else existing.get("targetPrice")

    update = {
        "url": result.url,
        "store": existing.get("store") or result.store,
        "currency": result.currency,
        "scrapeStatus": result.scrape_status,
        "lastUpdated": firestore.SERVER_TIMESTAMP,
    }
    if result.name:
        update["name"] = result.name
    if result.image:
        update["image"] = result.image
    if target_price is not None:
        update["targetPrice"] = target_price
    if not existing:
        update["createdAt"] = firestore.SERVER_TIMESTAMP

    if result.price is not None:
        change_pct, status = classify_change(previous_price, result.price)
        update.update(
            {
                "previousPrice": previous_price,
                "currentPrice": result.price,
                "changePct": change_pct,
                "status": status,
            }
        )

    product_ref.set(update, merge=True)

    if result.price is not None:
        product_ref.collection("priceHistory").add(
            {"price": result.price, "scrapedAt": firestore.SERVER_TIMESTAMP}
        )
        maybe_create_alert(
            db,
            result.product_id,
            update.get("name", existing.get("name", "Produto")),
            update["store"],
            target_price,
            previous_price,
            result.price,
        )

    logger.info(
        "produto=%s preco=%s status_coleta=%s", result.product_id, result.price, result.scrape_status
    )


def run_batch(db):
    docs = list(db.collection("products").stream())
    results = []

    for doc in docs:
        data = doc.to_dict()
        url = data.get("url")
        if not url:
            continue

        result = scrape_url(doc.id, url)
        save_result(db, result)
        results.append(result.__dict__)
        time.sleep(REQUEST_DELAY_SECONDS)

    if results:
        df = pd.DataFrame(results)
        logger.info("Resumo da coleta em lote:\n%s", df.to_string(index=False))
    else:
        logger.info("Nenhum produto para coletar.")
    return results


def run_single(db, url: str, product_id: Optional[str] = None, target_price: Optional[float] = None):
    product_id = product_id or db.collection("products").document().id
    result = scrape_url(product_id, url)
    save_result(db, result, target_price=target_price)
    return result


def main():
    parser = argparse.ArgumentParser(description="Scraper de preços PriceWatch -> Firestore")
    parser.add_argument("--url", help="URL avulsa para coletar (cria/atualiza o produto)")
    parser.add_argument("--product-id", help="ID do produto no Firestore (usado com --url)")
    parser.add_argument("--target-price", type=float, help="Preço-alvo para alertas (usado com --url)")
    parser.add_argument(
        "--cred", default=DEFAULT_CRED_PATH, help="Caminho da chave da conta de serviço"
    )
    args = parser.parse_args()

    db = init_firebase(args.cred)

    if args.url:
        result = run_single(db, args.url, args.product_id, args.target_price)
        logger.info("Resultado: %s", result)
    else:
        run_batch(db)


if __name__ == "__main__":
    main()