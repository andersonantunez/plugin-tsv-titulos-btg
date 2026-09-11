# Carteira para TSV — v2.10.2

Correção da leitura de detalhes do BTG.

## O que mudou

- Cada título é expandido individualmente e o plugin espera o `Código do produto` aparecer no **painel daquela própria linha** antes de avançar.
- A estrutura atual `div[info-item] > span[info-label] + span[info-value]` é suportada diretamente.
- Mantém compatibilidade com a estrutura antiga.
- `Código` e `Emissão` são lidos do detalhe real do título.
- `Valor Investido` continua sendo a soma de `Vlr. Aquisição` na aba `Posição por aquisição`.
- Os demais campos e cálculos das 15 colunas permanecem inalterados.

## Colunas

Código | Produto | Tipo | Valor Investido | Emissão | Vencimento | Dias Corridos | Dias Úteis | Taxa | Tipo Indexador | Preço Unitário | Quantidade | Valor Líquido | Rentabilidade Líquida | Rentabilidade Média
