# Editor de Imagem de Mapas

Editor web simples (HTML/CSS/JS puros) para revisar e editar mapas, desenhar Prohibition Areas e exportar imagem e YAML mantendo a resolução original.

## Demonstração
- Vídeo (YouTube): https://youtu.be/cCq1yT_o2wM

![Editor de Imagem de Mapas](./img/screenshot.png)

## Principais recursos
- Rotação somente visual do mapa (ferramentas continuam funcionais).
- Zoom e pan suaves.
- Ferramentas: Pan, Pincel (vermelho), Linha, Retângulo (alinhado à tela), Borracha.
- Exportação de imagem PNG/JPEG na resolução original.
- Opção para incluir/excluir as Prohibition Areas na imagem exportada; quando incluídas, são convertidas de vermelho para preto.
- Exportação de Prohibition Areas (YAML) a partir dos desenhos vermelhos.
- Importação de Prohibition Areas (YAML) como sobreposição para conferência.
- HUD com coordenadas do cursor em metros (x/y) e grade configurável.

## Requisitos
- Navegador moderno (Chrome, Edge, Firefox). Nenhuma instalação adicional é necessária.

Observação: o aplicativo tenta carregar `./map.yaml` via `fetch`. Ao abrir o `index.html` diretamente pelo sistema de arquivos, alguns navegadores podem bloquear a leitura (CORS). Nesse caso, o editor usa valores padrão (resolution 0.025, origin [0,0,0]). Para garantir a leitura do `map.yaml` local, sirva a pasta por um servidor estático.

## Como iniciar
1. Abra `frontend/image-editor/index.html` no navegador.
2. Clique em "Carregar imagem" e selecione o mapa (PNG/JPG).
3. Opcional: clique em "Importar Prohibition Areas" e selecione um YAML com as áreas (elas aparecem como sobreposição tracejada no HUD).

## Fluxo de trabalho sugerido
1. Carregue a imagem do mapa.
2. Ajuste a visualização com rotacionar/zoom/pan (a rotação é apenas visual).
3. Desenhe Prohibition Areas com o Pincel vermelho, Linha ou Retângulo (retângulo é alinhado à tela; segure Shift para quadrado).
4. Exporte:
   - Imagem (PNG/JPEG) preservando a resolução original.
   - Prohibition Areas (YAML) para uso no robô.
5. Para conferir áreas de outro robô, importe o YAML e compare com o mapa carregado.

## Ferramentas
- Pan (mover): ferramenta padrão ao iniciar.
- Pincel (vermelho): cria áreas livres à mão; somente vermelho é considerado funcional para exportar YAML.
- Borracha: remove partes desenhadas.
- Linha: desenha segmentos em vermelho (selecione vermelho) que entram no YAML.
- Retângulo (alinhado à tela): desenha retângulos sempre horizontais/verticais na tela, independente da rotação visual. Segure Shift para forçar quadrado.

## Rotação e Zoom
- Rotação: botões giram a visualização, não a imagem original.
- Zoom: controle deslizante ou botões.
- Exportação de imagem sempre ignora a rotação visual e mantém a orientação original.

## Importação e Exportação
### Imagem
- PNG/JPEG na resolução original da imagem importada.
- Fundo cinza (#cdcdcd) é aplicado onde não há conteúdo.
- Checkbox "Incluir áreas de proibição na imagem (preto)":
  - Desmarcado: não inclui as marcações vermelhas.
  - Marcado: inclui as marcações convertendo-as para preto (mantendo a transparência).

### Prohibition Areas (YAML)
- Exportação: gera `prohibition_areas.yaml` com vértices em metros, usando `resolution`, `origin` e `yaw` do `map.yaml` local (ou defaults).
- Importação: sobrepõe as áreas do arquivo selecionado para conferência (HUD). Não altera o desenho nem a exportação, exceto se você optar por incluir áreas na imagem.

Formato compatível (exemplo):
```
prohibition_areas:
  - [[1.23, 0.50], [2.10, 0.50]]
  - [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]
```
Cada item deve estar em uma única linha com pontos no formato `[x, y]` (o exportador segue esse padrão).

## Metadados do mapa (map.yaml)
- O editor tenta ler `./map.yaml` automaticamente. Se falhar, usa `resolution: 0.025` e `origin: [0,0,0]`.
- Para conversões corretas (pixel↔mundo), a imagem carregada deve corresponder ao `map.yaml` (mesma resolução e dimensões do mapa).

## Limitações conhecidas
- Apenas a cor vermelha (`#ff0000`) é considerada funcional para exportar áreas (YAML).
- Importação de áreas espera cada polilinha/polígono em uma única linha no YAML (mesmo padrão do export).
- Flip horizontal/vertical afeta a imagem (não é apenas visual), ao contrário da rotação.

## Dicas
- Use a rotação visual para alinhar melhor a visão antes de desenhar retângulos alinhados à tela.
- Ative/desative a exibição das áreas importadas para comparar o mapa atual com o mapa de outro robô.

---
Qualquer ajuste extra (atalhos, novos formatos, inclusão das áreas importadas na imagem exportada, etc.) pode ser adicionada conforme necessidade.
