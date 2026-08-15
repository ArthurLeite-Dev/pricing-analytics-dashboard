import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolvePythonBin } from "./scraperService";

describe("resolvePythonBin", () => {
  const cwd = "/home/user/projeto/backend";

  it("usa o caminho padrão do venv (POSIX) quando PYTHON_BIN não está definida", () => {
    const result = resolvePythonBin({}, "linux", cwd);
    expect(result).toBe(path.resolve(cwd, "../scraper/.venv/bin/python"));
  });

  it("usa o caminho padrão do venv (Windows) quando PYTHON_BIN não está definida", () => {
    const result = resolvePythonBin({}, "win32", cwd);
    expect(result).toBe(path.resolve(cwd, "../scraper/.venv/Scripts/python.exe"));
  });

  it("resolve PYTHON_BIN relativa ao cwd quando contém uma barra", () => {
    const result = resolvePythonBin({ PYTHON_BIN: "../custom/python" }, "linux", cwd);
    expect(result).toBe(path.resolve(cwd, "../custom/python"));
  });

  it("reconhece separador estilo Windows (\\) como caminho, não como comando de PATH", () => {
    // Roda no CI em Linux, então não afirmamos a resolução exata de path
    // do Windows aqui — só que a string foi reconhecida como CAMINHO
    // (entrou no path.resolve) em vez de devolvida sem alteração, que é o
    // que aconteceria se caísse no ramo de "comando de PATH" por engano.
    const result = resolvePythonBin({ PYTHON_BIN: "..\\custom\\python.exe" }, "win32", cwd);
    expect(result).not.toBe("..\\custom\\python.exe");
    expect(result).toContain("custom");
  });

  it("usa PYTHON_BIN como comando de PATH quando não tem separador de caminho", () => {
    const result = resolvePythonBin({ PYTHON_BIN: "python3" }, "linux", cwd);
    expect(result).toBe("python3");
  });
});
