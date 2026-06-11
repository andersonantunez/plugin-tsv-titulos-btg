# Carteira para TSV

Extensão para Chrome e Edge que exporta os produtos de renda fixa carregados na carteira atual para um arquivo TSV.

## Instalação

1. Extraia o ZIP.
2. Abra `chrome://extensions` ou `edge://extensions`.
3. Ative o modo do desenvolvedor.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `plugin_carteira_tsv_v2_5_preco_unitario_quantidade`.

## Uso

1. Abra a carteira de renda fixa e expanda a seção que contém as tabelas de produtos.
2. Aguarde a página terminar de carregar.
3. Abra a extensão.
4. Clique em **Baixar produtos em TSV**.
5. Aguarde enquanto a extensão abre e fecha o detalhe de cada produto para obter código e data de emissão.

## Colunas

```text
Código	Produto	Tipo	PreçoUnitário	Quantidade	Emissão	Vencimento	Taxa	ValorLiquido
```

A coluna `Tipo` informa a categoria do investimento: `CDB`, `LCI` ou `LCA`.

As colunas `PreçoUnitário` e `Quantidade` são extraídas da coluna **Preço e Qtd** da carteira.

O campo `PreçoUnitário` é exportado sem símbolo monetário e sem separador de milhar, preservando as casas decimais. A coluna `Quantidade` também é exportada sem separador de milhar.

## Formato do valor líquido

O campo `ValorLiquido` é exportado como número no padrão brasileiro, sem símbolo monetário e sem separador de milhar.

Exemplo:

```text
R$ 9.087,44 -> 9087,44
```

## Ordenação

As linhas do TSV são ordenadas pela data de vencimento, da mais próxima para a mais distante. Em caso de empate, a ordenação secundária é feita pelo nome do produto.
