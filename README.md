# Atur registrat al Maresme

Quadre de comandament interactiu de l'atur registrat a la comarca del Maresme i als seus 30 municipis (versió de prova).

## Fonts de les dades
- **Atur registrat:** Observatori del Treball i Model Productiu, Generalitat de Catalunya (via el paquet R [laboR](https://gerardreverte.github.io/laboR/)).
- **Afiliats a la Seguretat Social segons residència:** Idescat.
- **Límits municipals:** Institut Cartogràfic i Geològic de Catalunya (CC BY 4.0).

## Notes
- La taxa d'atur registral = atur / (atur + afiliats residents); no es pot calcular abans del març de 2012.
- En municipis de menys de 20.000 habitants els valors d'1 a 3 persones són ocults per secret estadístic; aquí s'han substituït per un valor aleatori reproduïble que fa quadrar el total del municipi. Interpreteu amb cautela les categories molt petites.
- Els gràfics usen [Apache ECharts](https://echarts.apache.org/) i [D3](https://d3js.org/), carregats des de jsDelivr.
