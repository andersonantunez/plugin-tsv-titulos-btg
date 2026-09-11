# Documentação técnica — Carteira para TSV v2.10.1

A versão 2.10.1 usa extração híbrida. Dados visíveis são lidos diretamente da tabela e dados de detalhe são buscados em lotes. A ausência de um campo de detalhe não impede o download.

## Colunas e origem

1. Código — detalhe do produto; fica vazio se indisponível.
2. Produto — tabela principal.
3. Tipo — grupo CDB, LCI ou LCA.
4. Valor Investido — soma de `Vlr. Aquisição` na aba `Posição por aquisição`; fica vazio se indisponível.
5. Emissão — detalhe do produto; fica vazia se indisponível.
6. Vencimento — tabela principal.
7. Dias Corridos — calculado entre Emissão e data da exportação.
8. Dias Úteis — calculado entre Emissão e data da exportação, excluindo sábados e domingos.
9. Taxa — tabela principal.
10. Tipo Indexador — calculado da Taxa.
11. Preço Unitário — tabela principal.
12. Quantidade — tabela principal.
13. Valor Líquido — tabela principal.
14. Rentabilidade Líquida — `((Valor Líquido / Valor Investido) - 1) * 100`.
15. Rentabilidade Média — taxa diária útil equivalente composta, calculada somente quando Valor Investido e Dias Úteis estiverem disponíveis.

Nenhum dado-base ausente é estimado. Campos derivados ficam vazios quando sua base de cálculo não existir.


## Correção 2.10.1

A leitura dos detalhes foi atualizada para a estrutura atual do BTG, que usa `div[info-item]`, `span[info-label]` e `span[info-value]`. Isso restaura a captura de campos como `Código do produto` sem remover a compatibilidade com a estrutura anterior.

## Correção 2.10.2

A extração dos detalhes deixou de abrir grandes lotes simultaneamente. O portal injeta o conteúdo de cada painel após a expansão; portanto, a versão 2.10.2 associa a leitura à linha específica e espera o `info-item` com `Código do produto` antes de seguir para o título seguinte. Isso evita perda ou mistura de detalhes entre produtos.
