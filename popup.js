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

function converterNumeroBrasileiro(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (valor === null || valor === undefined) return null;

  const bruto = limparCelula(valor);
  if (!bruto) return null;

  const normalizado = bruto
    .replace(/^R\$\s*/i, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalizado || normalizado === "-" || normalizado === ".") return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function formatarDecimalBrasileiro(valor, casas = 2) {
  if (!Number.isFinite(valor)) return "";
  return valor.toLocaleString("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function calcularValorInvestido(produto) {
  return converterNumeroBrasileiro(produto.valorInvestido);
}

function classificarIndexador(taxa) {
  const valor = limparCelula(taxa)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (/IPCA|IGP-M|IGPM|INPC/.test(valor)) return "INFLAÇÃO";
  if (/CDI|SELIC|DI\b/.test(valor)) return "PÓS-FIXADO";
  if (valor) return "PRÉ-FIXADO";
  return "";
}

function interpretarDataBrasileira(valor) {
  const partes = limparCelula(valor).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return null;

  const data = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]));
  if (
    data.getFullYear() !== Number(partes[3]) ||
    data.getMonth() !== Number(partes[2]) - 1 ||
    data.getDate() !== Number(partes[1])
  ) return null;

  data.setHours(0, 0, 0, 0);
  return data;
}

function obterPeriodoDecorrido(emissao) {
  const inicio = interpretarDataBrasileira(emissao);
  const fim = new Date();
  fim.setHours(0, 0, 0, 0);
  if (!inicio || inicio > fim) return { corridos: null, uteis: null };

  // Arredondar evita desvios de uma hora causados por mudanças históricas de fuso/DST.
  const corridos = Math.round((fim - inicio) / 86400000);
  let uteis = 0;
  const cursor = new Date(inicio);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= fim) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) uteis += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { corridos, uteis };
}

function calcularRentabilidades(produto, valorInvestido, diasUteis) {
  const valorLiquido = converterNumeroBrasileiro(produto.valorLiquido);
  if (valorInvestido === null || valorInvestido <= 0 || valorLiquido === null) {
    return { liquida: null, porDiaUtil: null };
  }

  const liquida = ((valorLiquido / valorInvestido) - 1) * 100;
  const porDiaUtil = diasUteis > 0
    ? (Math.pow(valorLiquido / valorInvestido, 1 / diasUteis) - 1) * 100
    : null;
  return { liquida, porDiaUtil };
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
    "Valor Investido",
    "Emissão",
    "Vencimento",
    "Dias Corridos",
    "Dias Úteis",
    "Taxa",
    "Tipo Indexador",
    "Preço Unitário",
    "Quantidade",
    "Valor Líquido",
    "Rentabilidade Líquida",
    "Rentabilidade Média"
  ];

  const linhas = ordenarPorVencimento(produtos).map(produto => {
    const valorInvestido = calcularValorInvestido(produto);
    const periodo = obterPeriodoDecorrido(produto.emissao);
    const rentabilidades = calcularRentabilidades(produto, valorInvestido, periodo.uteis);

    return [
      limparCelula(produto.codigo),
      limparCelula(produto.produto),
      limparCelula(produto.tipo),
      formatarDecimalBrasileiro(valorInvestido),
      limparCelula(produto.emissao),
      limparCelula(produto.vencimento),
      periodo.corridos ?? "",
      periodo.uteis ?? "",
      limparCelula(produto.taxa),
      classificarIndexador(produto.taxa),
      formatarPrecoUnitario(produto.precoUnitario),
      formatarQuantidade(produto.quantidade),
      formatarValorLiquido(produto.valorLiquido),
      formatarDecimalBrasileiro(rentabilidades.liquida, 6),
      formatarDecimalBrasileiro(rentabilidades.porDiaUtil, 8)
    ].join("\t");
  });

  return [cabecalho.join("\t"), ...linhas].join("\n");
}

async function baixarArquivo(conteudo) {
  const blob = new Blob(["\uFEFF", conteudo], {
    type: "text/tab-separated-values;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const agora = new Date();
  const data = agora.toISOString().slice(0, 10);
  const hora = agora.toTimeString().slice(0, 8).replace(/:/g, "-");
  const nomeArquivo = `carteira-produtos-${data}_${hora}.tsv`;

  try {
    if (chrome.downloads?.download) {
      await chrome.downloads.download({
        url,
        filename: nomeArquivo,
        saveAs: false,
        conflictAction: "uniquify"
      });
      return;
    }

    // Fallback para navegadores que não disponibilizem chrome.downloads.
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
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

      const clicar = elemento => {
        if (!elemento) return false;
        try {
          elemento.click();
          return true;
        } catch (_) {
          try {
            elemento.dispatchEvent(new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window
            }));
            return true;
          } catch (_) {
            return false;
          }
        }
      };

      const esperarAte = async (condicao, limiteMs = 1800, intervaloMs = 60) => {
        const inicio = Date.now();
        while (Date.now() - inicio < limiteMs) {
          const valor = condicao();
          if (valor) return valor;
          await esperar(intervaloMs);
        }
        return condicao() || null;
      };

      const localizarCardRendaFixa = () =>
        document.querySelector('core-expandable-card[data-testid="allocation-summary-card-id-RF"]') ||
        [...document.querySelectorAll("core-expandable-card")].find(item =>
          normalizar(texto(item.querySelector('[data-testid="type"]'))) === "renda fixa"
        );

      const card = localizarCardRendaFixa();
      if (!card) {
        return { produtos: [], motivo: "Não foi possível localizar o card de Renda Fixa." };
      }

      let linhas = [...card.querySelectorAll(
        'tr[data-testid="product"], tr.bank-deposit-products__product'
      )];

      if (!linhas.length) {
        const cabecalho = card.querySelector(
          'header[data-testid="card-header"], [data-system-integration-element-id="EXPANDABLE_CARD_HEADER"]'
        );
        clicar(cabecalho);
        await esperarAte(() => card.querySelector('tr[data-testid="product"]'), 2200, 60);
        linhas = [...card.querySelectorAll(
          'tr[data-testid="product"], tr.bank-deposit-products__product'
        )];
      }

      const obterTituloProduto = linha => texto(linha.querySelector(
        '[data-testid="summary-title"], .product__title, .bank-deposit-products__product-title'
      ));

      linhas = linhas.filter(linha => obterTituloProduto(linha));
      if (!linhas.length) {
        return { produtos: [], motivo: "Nenhuma linha de produto foi encontrada em Renda Fixa." };
      }

      const obterCategoria = linha => {
        const validas = new Set(["CDB", "LCI", "LCA"]);
        const grupo = linha.closest(".portfolio-allocation-product-group");
        const tituloGrupo = texto(grupo?.querySelector(
          'portfolio-allocation-summary-detail-header h1, [data-testid="allocation-summary-header-description"]'
        )).toUpperCase();
        if (validas.has(tituloGrupo)) return tituloGrupo;

        const cabecalhos = [...card.querySelectorAll(
          'portfolio-allocation-summary-detail-header h1, [data-testid="allocation-summary-header-description"]'
        )];
        for (let i = cabecalhos.length - 1; i >= 0; i -= 1) {
          const cabecalho = cabecalhos[i];
          const categoria = texto(cabecalho).toUpperCase();
          const antes = Boolean(
            cabecalho.compareDocumentPosition(linha) & Node.DOCUMENT_POSITION_FOLLOWING
          );
          if (antes && validas.has(categoria)) return categoria;
        }
        return "";
      };

      const obterPrecoQuantidade = linha => {
        const container = linha.querySelector(
          'section.portfolio-allocation-listing-quantity, ' +
          '[portfolio-allocation-listing-quantity] section, ' +
          '.bank-deposit-products__product-quantity'
        );
        return {
          precoUnitario: texto(container?.querySelector("span")),
          quantidade: texto(container?.querySelector("small"))
        };
      };

      const obterExpansor = linha => {
        const celula = linha.querySelector('td[portfolio-allocation-listing-expand-toggle]');
        return celula?.querySelector(
          'orq-icon-container[name="chevron-down"], orq-icon-container.portfolio-allocation-listing-expand-toggle'
        ) ||
        linha.querySelector('.bank-deposit-products__product-expand-button') ||
        linha.querySelector('orq-icon-container.portfolio-allocation-listing-expand-toggle') ||
        celula ||
        linha.querySelector('[portfolio-allocation-listing-expand-toggle]');
      };

      const obterHostDetalhe = linha => {
        const linhaDetalhe = linha.nextElementSibling;
        if (!linhaDetalhe) return null;
        return linhaDetalhe.querySelector(
          '.portfolio-allocation-product-detail, .bank-deposit-products__product-detail'
        ) || linhaDetalhe;
      };

      const obterRaizDetalhe = linha => {
        const host = obterHostDetalhe(linha);
        if (!host) return null;
        return host.querySelector(
          'portfolio-bank-deposit-products-detail, .bank-deposit-products-detail, ' +
          '[data-testid*="bank-deposit-products-detail"], [data-testid*="product-detail"]'
        ) || (host.children.length ? host : null);
      };

      const detalheTemConteudo = linha => {
        const raiz = obterRaizDetalhe(linha);
        return raiz && texto(raiz).length > 0 ? raiz : null;
      };

      const obterMapaDetalhes = raiz => {
        const mapa = new Map();
        if (!raiz) return mapa;

        const adicionar = (rotulo, valor) => {
          const chave = normalizar(rotulo);
          const conteudo = texto(valor);
          if (chave && conteudo && !mapa.has(chave)) mapa.set(chave, conteudo);
        };

        // Estrutura atual do BTG (2026):
        // <div info-item><span info-label>Código do produto</span><span info-value>...</span></div>
        raiz.querySelectorAll('[info-item]').forEach(item => {
          const rotuloEl = item.querySelector('[info-label]');
          const valorEl = item.querySelector('[info-value]');
          adicionar(texto(rotuloEl), valorEl);
        });

        // Estrutura anterior do BTG, mantida por compatibilidade.
        raiz.querySelectorAll('.bank-deposit-products-detail__infos-item').forEach(item => {
          adicionar(
            texto(item.querySelector('small, label, dt, [info-label]')),
            item.querySelector('span, strong, dd, p, [info-value]')
          );
        });

        // Fallback genérico para rótulo/valor em atributos sem depender das classes Angular.
        raiz.querySelectorAll('[info-label]').forEach(rotuloEl => {
          const item = rotuloEl.closest('[info-item]') || rotuloEl.parentElement;
          const valorEl = item?.querySelector('[info-value]');
          if (valorEl) adicionar(texto(rotuloEl), valorEl);
        });

        raiz.querySelectorAll('small, label, dt').forEach(rotuloEl => {
          const rotulo = texto(rotuloEl);
          if (!rotulo) return;
          const pai = rotuloEl.closest('div, li, section, article') || rotuloEl.parentElement;
          if (!pai) return;

          const candidatos = [...pai.querySelectorAll('span, strong, dd, p')]
            .filter(el => el !== rotuloEl && !rotuloEl.contains(el));
          const valorEl = candidatos.find(el =>
            texto(el) && normalizar(texto(el)) !== normalizar(rotulo)
          );
          if (valorEl) adicionar(rotulo, valorEl);
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

      const obterAba = (raiz, nomes) => {
        if (!raiz) return null;
        const esperados = nomes.map(normalizar);
        return [...raiz.querySelectorAll('.orq-tabs__tab, [role="tab"], [data-testid*="tab"]')]
          .find(item => {
            const valor = normalizar(texto(item));
            return esperados.some(esperado => valor.includes(esperado));
          }) || null;
      };

      const abaAtiva = aba => Boolean(
        aba?.classList?.contains('orq-tabs__tab--active') ||
        aba?.getAttribute?.('aria-selected') === 'true'
      );

      const obterTabelaAquisicoes = raiz => {
        if (!raiz) return null;
        const especifica = raiz.querySelector(
          'table[data-testid="table-position-acquisition"], ' +
          '[data-testid="table-position-acquisition"] table'
        );
        if (especifica) return especifica;

        return [...raiz.querySelectorAll('table')].find(tabela => {
          const cabecalhos = [...tabela.querySelectorAll('thead th')]
            .map(item => normalizar(texto(item)));
          return cabecalhos.some(rotulo =>
            rotulo === 'vlr. aquisicao' ||
            rotulo.includes('valor aquisicao') ||
            rotulo.includes('vlr aquisicao')
          );
        }) || null;
      };

      const obterValorAquisicao = tabela => {
        if (!tabela) return null;
        const cabecalhos = [...tabela.querySelectorAll('thead th')]
          .map(item => normalizar(texto(item)));
        const indice = cabecalhos.findIndex(rotulo =>
          rotulo === 'vlr. aquisicao' ||
          rotulo.includes('valor aquisicao') ||
          rotulo.includes('vlr aquisicao')
        );
        if (indice < 0) return null;

        const valores = [...tabela.querySelectorAll('tbody tr')]
          .map(item => texto(item.querySelectorAll('td')[indice]))
          .map(valor => Number(valor
            .replace(/^R\$\s*/i, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[^\d.-]/g, '')))
          .filter(Number.isFinite);

        return valores.length
          ? valores.reduce((total, valor) => total + valor, 0)
          : null;
      };

      const produtos = linhas.map(linha => {
        const celulas = [...linha.querySelectorAll(':scope > td')];
        const pq = obterPrecoQuantidade(linha);
        return {
          codigo: "",
          produto: obterTituloProduto(linha),
          tipo: obterCategoria(linha),
          valorInvestido: null,
          precoUnitario: pq.precoUnitario,
          quantidade: pq.quantidade,
          emissao: "",
          vencimento: texto(celulas[1]),
          taxa: texto(celulas[2]),
          valorLiquido: texto(celulas[4])
        };
      });

      // A estrutura atual do BTG injeta o conteúdo do detalhe somente depois
      // da expansão da linha. Abrir dezenas de títulos ao mesmo tempo pode fazer o
      // componente reutilizar/fechar painéis antes da leitura. Por isso os detalhes
      // são vinculados à linha exata: abre -> espera "Código do produto" -> lê ->
      // consulta aquisição -> fecha -> segue. Não há timeout fixo quando o conteúdo
      // já está disponível; a espera ocorre somente enquanto o Angular renderiza.
      let detalhesLidos = 0;
      let aquisicoesLidas = 0;

      const lerCodigoEEmissaoDaLinha = linha => {
        const host = obterHostDetalhe(linha);
        const mapa = obterMapaDetalhes(host);
        return {
          codigo: obterCampo(mapa, [
            'Código do produto', 'Codigo do produto', 'Código', 'Codigo'
          ]),
          emissao: obterCampo(mapa, [
            'Data de emissão', 'Data de emissao', 'Emissão', 'Emissao'
          ])
        };
      };

      const esperarCodigoDaLinha = linha => esperarAte(() => {
        const dados = lerCodigoEEmissaoDaLinha(linha);
        return dados.codigo ? dados : null;
      }, 1200, 25);

      for (let indice = 0; indice < linhas.length; indice += 1) {
        const linha = linhas[indice];
        const produto = produtos[indice];

        let dadosDetalhe = lerCodigoEEmissaoDaLinha(linha);
        let abriuPeloPlugin = false;

        // Código é obrigatório no portal. Se ainda não está no DOM, expande esta
        // linha específica e só avança depois que o info-item correspondente surgir.
        if (!dadosDetalhe.codigo) {
          linha.scrollIntoView?.({ block: 'center', inline: 'nearest' });
          await esperar(15);
          const expansor = obterExpansor(linha);
          if (clicar(expansor)) abriuPeloPlugin = true;
          dadosDetalhe = (await esperarCodigoDaLinha(linha)) || lerCodigoEEmissaoDaLinha(linha);

          // Segunda janela curta de espera sem novo clique. Evita fechar um painel
          // que abriu corretamente mas cujo conteúdo Angular demorou um pouco mais.
          if (!dadosDetalhe.codigo) {
            dadosDetalhe = (await esperarAte(() => {
              const dados = lerCodigoEEmissaoDaLinha(linha);
              return dados.codigo ? dados : null;
            }, 900, 30)) || lerCodigoEEmissaoDaLinha(linha);
          }
        }

        // Alguns layouts abrem outra aba por padrão. Se a emissão ainda não apareceu,
        // seleciona "Detalhes" e relê o mesmo painel da mesma linha.
        if (!dadosDetalhe.emissao) {
          const raiz = obterRaizDetalhe(linha) || obterHostDetalhe(linha);
          const abaDetalhes = obterAba(raiz, ['Detalhes']);
          if (abaDetalhes && !abaAtiva(abaDetalhes)) {
            clicar(abaDetalhes);
            await esperarAte(() => {
              const dados = lerCodigoEEmissaoDaLinha(linha);
              return (dados.codigo || dados.emissao) ? dados : null;
            }, 500, 25);
            dadosDetalhe = lerCodigoEEmissaoDaLinha(linha);
          }
        }

        produto.codigo = dadosDetalhe.codigo || '';
        produto.emissao = dadosDetalhe.emissao || '';
        if (produto.codigo || produto.emissao) detalhesLidos += 1;

        // Valor Investido continua vindo exclusivamente de "Vlr. Aquisição".
        // A leitura também é vinculada ao painel atual, evitando misturar produtos.
        const raiz = obterRaizDetalhe(linha) || obterHostDetalhe(linha);
        if (raiz) {
          let tabela = obterTabelaAquisicoes(raiz);
          if (!tabela) {
            const abaAquisicao = obterAba(raiz, [
              'Posição por aquisição', 'Posicao por aquisicao', 'Aquisição', 'Aquisicao'
            ]);
            if (abaAquisicao) {
              if (!abaAtiva(abaAquisicao)) clicar(abaAquisicao);
              tabela = await esperarAte(() => obterTabelaAquisicoes(
                obterRaizDetalhe(linha) || obterHostDetalhe(linha)
              ), 850, 25);
            }
          }

          const valor = obterValorAquisicao(tabela);
          produto.valorInvestido = valor;
          if (Number.isFinite(valor)) aquisicoesLidas += 1;
        }

        // Fecha somente o painel aberto pelo plugin. Uma pausa mínima permite que o
        // Angular conclua a animação sem acumular eventos de clique.
        if (abriuPeloPlugin) {
          clicar(obterExpansor(linha));
          await esperar(12);
        }
      }

      return {
        produtos,
        diagnostico: {
          total: produtos.length,
          detalhesLidos,
          aquisicoesLidas
        }
      };
    }
  });

  return resultados?.[0]?.result || { produtos: [] };
}

botao.addEventListener("click", async () => {
  botao.disabled = true;
  definirMensagem(
    "Lendo a carteira, buscando detalhes e calculando as colunas derivadas...",
    "info"
  );

  try {
    const aba = await obterAbaAtiva();
    const resposta = await extrairNaPagina(aba.id);
    const produtos = Array.isArray(resposta?.produtos) ? resposta.produtos : [];

    if (!produtos.length) {
      throw new Error(
        resposta?.motivo || "Nenhum produto foi encontrado na carteira atual."
      );
    }

    const semCodigo = produtos.filter(p => !p.codigo).length;
    const semValorInvestido = produtos.filter(p => !Number.isFinite(p.valorInvestido)).length;
    const semEmissao = produtos.filter(p => !p.emissao).length;

    if (semCodigo) {
      const exemplos = produtos
        .filter(p => !p.codigo)
        .slice(0, 5)
        .map(p => p.produto)
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `O BTG possui código para todos os títulos, mas ${semCodigo} código(s) não foram lidos. ` +
        `O arquivo não foi gerado para evitar exportação incompleta.` +
        (exemplos ? ` Títulos: ${exemplos}${semCodigo > 5 ? "..." : ""}` : "")
      );
    }

    definirMensagem(`Preparando ${produtos.length} produtos...`, "info");
    await baixarArquivo(gerarTsv(produtos));

    if (semCodigo || semValorInvestido || semEmissao) {
      definirMensagem(
        `${produtos.length} produtos exportados. Dados não encontrados no BTG: ` +
        `código em ${semCodigo}, valor investido em ${semValorInvestido} e emissão em ${semEmissao}. ` +
        `As colunas derivadas foram calculadas somente quando havia dados suficientes.`,
        "info"
      );
    } else {
      definirMensagem(`${produtos.length} produtos exportados com todas as colunas.`, "success");
    }
  } catch (erro) {
    console.error(erro);
    definirMensagem(erro?.message || "Não foi possível gerar o arquivo TSV.", "error");
  } finally {
    botao.disabled = false;
  }
});
