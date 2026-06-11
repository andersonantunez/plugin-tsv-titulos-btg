const botao = document.getElementById("baixar");
const mensagem = document.getElementById("mensagem");

function definirMensagem(texto = "", tipo = "") {
  mensagem.textContent = texto;
  mensagem.className = `message ${tipo}`.trim();
}

function limparCelula(valor) {
  return String(valor ?? "")
    .replace(/\t/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatarNumeroBrasileiro(valor) {
  return limparCelula(valor)
    .replace(/^R\$\s*/i, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "");
}

function formatarPrecoUnitario(valor) {
  return formatarNumeroBrasileiro(valor);
}

function formatarQuantidade(valor) {
  return limparCelula(valor)
    .replace(/\./g, "")
    .replace(/\s+/g, "");
}

function formatarValorLiquido(valor) {
  return formatarNumeroBrasileiro(valor);
}

function obterTimestampVencimento(valor) {
  const data = limparCelula(valor);
  const partes = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!partes) return Number.POSITIVE_INFINITY;

  const [, dia, mes, ano] = partes;
  return Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
}

function ordenarPorVencimento(produtos) {
  return [...produtos].sort((produtoA, produtoB) => {
    const diferencaDatas =
      obterTimestampVencimento(produtoA.vencimento) -
      obterTimestampVencimento(produtoB.vencimento);

    if (diferencaDatas !== 0) return diferencaDatas;

    return limparCelula(produtoA.produto).localeCompare(
      limparCelula(produtoB.produto),
      "pt-BR"
    );
  });
}

function gerarTsv(produtos) {
  const cabecalho = [
    "Código",
    "Produto",
    "Tipo",
    "PreçoUnitário",
    "Quantidade",
    "Emissão",
    "Vencimento",
    "Taxa",
    "ValorLiquido"
  ];

  const linhas = ordenarPorVencimento(produtos).map(produto => [
    limparCelula(produto.codigo),
    limparCelula(produto.produto),
    limparCelula(produto.tipo),
    formatarPrecoUnitario(produto.precoUnitario),
    formatarQuantidade(produto.quantidade),
    limparCelula(produto.emissao),
    limparCelula(produto.vencimento),
    limparCelula(produto.taxa),
    formatarValorLiquido(produto.valorLiquido)
  ].join("\t"));

  return [cabecalho.join("\t"), ...linhas].join("\n");
}

function baixarArquivo(conteudo) {
  const blob = new Blob(["\uFEFF", conteudo], {
    type: "text/tab-separated-values;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const agora = new Date();
  const data = agora.toISOString().slice(0, 10);
  const hora = agora.toTimeString().slice(0, 8).replace(/:/g, "-");

  link.href = url;
  link.download = `carteira-produtos-${data}_${hora}.tsv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function obterAbaAtiva() {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id) throw new Error("Não foi possível identificar a aba ativa.");
  return aba;
}

async function extrairNaPagina(tabId) {
  const resultados = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

      const texto = elemento => (elemento?.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const normalizar = valor => String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const dispararClique = elemento => {
        if (!elemento) return;
        elemento.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window
        }));
      };

      const esperarAte = async (condicao, limiteMs = 2500, intervaloMs = 80) => {
        const inicio = Date.now();
        while (Date.now() - inicio < limiteMs) {
          const valor = condicao();
          if (valor) return valor;
          await esperar(intervaloMs);
        }
        return condicao() || null;
      };

      const obterCategoria = linha => {
        const categoriasValidas = new Set(["CDB", "LCI", "LCA"]);
        const tabelaDesign = linha.closest("orq-table-design");
        let anterior = tabelaDesign?.previousElementSibling;

        while (anterior) {
          const titulo = texto(anterior.querySelector?.("h1")).toUpperCase();
          if (categoriasValidas.has(titulo)) return titulo;
          anterior = anterior.previousElementSibling;
        }

        // Fallback: localiza o último cabeçalho de categoria posicionado antes da linha.
        const cabecalhos = [...document.querySelectorAll(
          "portfolio-allocation-summary-detail-header h1"
        )];

        for (let indice = cabecalhos.length - 1; indice >= 0; indice -= 1) {
          const cabecalho = cabecalhos[indice];
          const titulo = texto(cabecalho).toUpperCase();
          const estaAntesDaLinha = Boolean(
            cabecalho.compareDocumentPosition(linha) & Node.DOCUMENT_POSITION_FOLLOWING
          );

          if (estaAntesDaLinha && categoriasValidas.has(titulo)) return titulo;
        }

        return "";
      };

      const obterMapaDetalhes = raiz => {
        const mapa = new Map();
        if (!raiz) return mapa;

        raiz.querySelectorAll(".bank-deposit-products-detail__infos-item").forEach(item => {
          const rotulo = normalizar(texto(item.querySelector("small, label, dt")));
          const valor = texto(item.querySelector("span, strong, dd, p"));
          if (rotulo && valor && !mapa.has(rotulo)) mapa.set(rotulo, valor);
        });

        return mapa;
      };

      const obterCampo = (mapa, alternativas) => {
        const esperados = alternativas.map(normalizar);

        for (const [rotulo, valor] of mapa.entries()) {
          if (esperados.includes(rotulo)) return valor;
        }

        for (const [rotulo, valor] of mapa.entries()) {
          if (esperados.some(esperado => rotulo.includes(esperado))) return valor;
        }

        return "";
      };

      const linhas = [...document.querySelectorAll(
        'tr[data-testid="product"], tr.bank-deposit-products__product'
      )].filter(linha => linha.querySelector(".bank-deposit-products__product-title"));

      if (linhas.length === 0) {
        return {
          produtos: [],
          motivo: "Nenhuma linha de produto foi encontrada no HTML da página atual."
        };
      }

      const produtos = [];

      for (const linha of linhas) {
        const celulas = [...linha.querySelectorAll(":scope > td")];
        const celulaProduto = celulas[0];
        const pequenos = [...(celulaProduto?.querySelectorAll("small") || [])]
          .map(texto)
          .filter(Boolean);

        const precoQuantidade = celulas[3]?.querySelector(
          ".bank-deposit-products__product-quantity"
        );

        const produto = {
          codigo: "",
          produto: texto(celulaProduto?.querySelector(".bank-deposit-products__product-title")),
          tipo: obterCategoria(linha),
          precoUnitario: texto(precoQuantidade?.querySelector("span")),
          quantidade: texto(precoQuantidade?.querySelector("small")),
          emissao: "",
          vencimento: texto(celulas[1]),
          taxa: texto(celulas[2]),
          valorLiquido: texto(celulas[4])
        };

        const linhaDetalhe = linha.nextElementSibling;
        const containerDetalhe = linhaDetalhe?.querySelector(".bank-deposit-products__product-detail");
        let raizDetalhe = containerDetalhe?.querySelector(
          "portfolio-bank-deposit-products-detail, .bank-deposit-products-detail"
        );

        let abriuAgora = false;
        if (!raizDetalhe) {
          const expansor = linha.querySelector(".bank-deposit-products__product-expand-button");
          dispararClique(expansor);
          abriuAgora = true;

          raizDetalhe = await esperarAte(() => containerDetalhe?.querySelector(
            "portfolio-bank-deposit-products-detail, .bank-deposit-products-detail"
          ));
        }

        const mapa = obterMapaDetalhes(raizDetalhe);
        produto.codigo = obterCampo(mapa, ["Código do produto", "Codigo do produto"]);
        produto.emissao = obterCampo(mapa, ["Data de emissão", "Data de emissao", "Emissão", "Emissao"]);
        produtos.push(produto);

        if (abriuAgora) {
          const expansor = linha.querySelector(".bank-deposit-products__product-expand-button");
          dispararClique(expansor);
          await esperar(40);
        }
      }

      return { produtos };
    }
  });

  return resultados?.[0]?.result || { produtos: [] };
}

botao.addEventListener("click", async () => {
  botao.disabled = true;
  definirMensagem(
    "Lendo as linhas e abrindo os detalhes de cada produto. Aguarde até o download iniciar.",
    "info"
  );

  try {
    const aba = await obterAbaAtiva();
    const resposta = await extrairNaPagina(aba.id);
    const produtos = Array.isArray(resposta?.produtos) ? resposta.produtos : [];

    if (produtos.length === 0) {
      throw new Error(
        resposta?.motivo ||
        "Nenhum produto foi encontrado. Abra a carteira, expanda a categoria de renda fixa e tente novamente."
      );
    }

    baixarArquivo(gerarTsv(produtos));

    const semCodigo = produtos.filter(produto => !produto.codigo).length;
    const semPrecoUnitario = produtos.filter(produto => !produto.precoUnitario).length;
    const semQuantidade = produtos.filter(produto => !produto.quantidade).length;
    const semEmissao = produtos.filter(produto => !produto.emissao).length;

    if (semCodigo || semPrecoUnitario || semQuantidade || semEmissao) {
      definirMensagem(
        `${produtos.length} produtos exportados. Campos não lidos: código em ${semCodigo} linha(s), preço unitário em ${semPrecoUnitario}, quantidade em ${semQuantidade} e emissão em ${semEmissao}.`,
        "info"
      );
    } else {
      definirMensagem(`${produtos.length} produtos exportados com sucesso.`, "success");
    }
  } catch (erro) {
    console.error(erro);
    definirMensagem(erro?.message || "Não foi possível gerar o arquivo TSV.", "error");
  } finally {
    botao.disabled = false;
  }
});
