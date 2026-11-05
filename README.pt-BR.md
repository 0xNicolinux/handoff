<p align="center">
  <img src="assets/banner.png" alt="/handoff: Pare no meio da tarefa. Não perca nada. Um skill do Claude Code que termina o que está rodando, faz commit local e deixa um único arquivo no qual a próxima sessão pode confiar." width="100%">
</p>

<p align="center">
  <a href="#instalação"><img alt="Plugin do Claude Code" src="https://img.shields.io/badge/Claude_Code-plugin-138840?style=flat-square"></a>
  <a href="skills/handoff/SKILL.md"><img alt="Agent Skills: SKILL.md" src="https://img.shields.io/badge/Agent_Skills-SKILL.md-0b100c?style=flat-square"></a>
  <img alt="Zero dependências" src="https://img.shields.io/badge/dependências-0-138840?style=flat-square">
  <a href="LICENSE"><img alt="Licença MIT" src="https://img.shields.io/badge/licença-MIT-0b100c?style=flat-square"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <b>Português (Brasil)</b>
</p>

**`/handoff` é um skill do Claude Code para quando uma sessão precisa terminar no meio de uma tarefa.** Ele deixa terminar o que já estava rodando, faz commit local e escreve um único `HANDOFF.md` a partir do qual uma sessão sem contexto consegue retomar sem adivinhar. E então para. Funciona em qualquer agente que leia `SKILL.md`.

Sem ele, bater no limite de uso no meio da tarefa significa que a sessão de amanhã começa do zero: lê o código de novo, roda os testes de novo e tenta outra vez o que já falhou ontem.

```
/plugin marketplace add asalazarvaldiviaocg/handoff
/plugin install handoff@handoff
```

<p align="center">
  <img src="assets/demo.svg" alt="Demo no terminal: /handoff espera uma revisão em andamento, verifica o estado do repositório, faz um commit WIP local, escreve e valida o HANDOFF.md. Na manhã seguinte, uma sessão nova encontra o handoff, confere o git, lê o que falhou e faz a primeira pergunta." width="100%">
</p>

<sub>O skill e o demo estão em inglês; o handoff é escrito no idioma em que você fala com ele.</sub>

## O que acontece quando você o executa

Digite `/handoff`, ou diga *"encerre a sessão"*, *"vamos parar por aqui"* ou *"acabou meu limite de uso"*.

| Fase | O que faz | O que se recusa a fazer |
|---|---|---|
| **0. Congelar** | Diz em uma linha o que ainda está rodando e quanto tempo falta. Deixa essa unidade terminar: uma revisão de código entrega seus achados, um workflow seus diffs, uma suíte de testes seus números. | Começar o próximo bug, outra rodada de revisão ou "uma correção rápida". |
| **1. Evidência** | Lê o estado real: branch, HEAD, arquivos modificados, commits não enviados, segredos nas mudanças e nos commits, os resultados dos últimos testes. | Confiar no que lembra da conversa. |
| **2. Commit** | Faz commit, por nome, dos arquivos que editou nesta sessão, em cada repositório que tocou. Testes falhando viram um commit `WIP:` honesto. | Fazer deploy. Fazer push, a menos que você peça naquele turno. Mexer em arquivos que não editou. Adicionar um `.env`. |
| **3. Escrever** | Escreve o `HANDOFF.md` com cinco seções e roda um verificador nele. | Entregar um arquivo com seções vazias, lacunas `{{template}}` ou marcadores como `<repo>`. |
| **4. Parar** | Diz onde está o arquivo, o que você precisa decidir e a frase exata para retomar. | Continuar trabalhando depois dessa mensagem. |

## As cinco seções

Todo handoff tem o mesmo formato, escrito no seu idioma:

| # | Seção | Responde |
|---|---|---|
| 1 | **Objetivo** | O que você pediu, citado, e as regras que você definiu (sem push, sem deploy, limite de rodadas de revisão). |
| 2 | **Em que estado tudo terminou** | Por repositório: branch, HEAD, limpo ou não, enviado ou não. Testes com números. O que foi verificado e o que um agente apenas afirmou. |
| 3 | **O que mudou** | Arquivo por arquivo, com o commit. O que foi deixado de lado de propósito. |
| 4 | **O que tentamos e falhou** | Cada beco sem saída com sua causa real e *o que fazer em vez disso*. |
| 5 | **Próximos passos exatos** | Numerados, com comandos completos e caminhos absolutos. Suas decisões pendentes primeiro, como A/B. |

A seção 4 é a razão de existir deste skill. Ela lista cada beco sem saída com sua causa, para que a próxima sessão não o repita. Do [handoff de exemplo](skills/handoff/references/example-handoff.md):

> **False premise about the function timeout.** Took "10 s per request" from an old forum answer, so I cut the provider call timeout to 8 s → legitimate slow charges got retried → that caused F2. The official platform docs say 60 s. **Instead:** read the official limits page before designing around a limit.

(Em português: uma premissa falsa sobre o tempo limite da função, tirada de uma resposta antiga de fórum, causou um bug; a documentação oficial da plataforma dizia outra coisa. Em vez disso: ler a página oficial de limites antes de projetar em torno de um limite.)

## Retome de onde parou

Abra uma sessão na mesma pasta e diga:

```
continue from HANDOFF.md
```

(ou *"continue a partir do HANDOFF.md"*). O agente primeiro confere o arquivo com a realidade (o HEAD ainda é o mesmo da seção 2? a árvore está limpa?), lê a seção 4 antes de tocar no código, faz suas perguntas A/B pendentes e começa pelo passo 1. Com o plugin instalado, uma sessão nova avisa que há um handoff esperando antes mesmo de você pedir:

```
Handoff waiting: ledgerline: idempotent payment webhook (STOPPED AT USAGE LIMIT, 9 h ago). To pick it up, say: continue from HANDOFF.md
```

**Vai trocar de máquina?** Guarde os handoffs em uma pasta que sincronize (veja [Configuração](#configuração)) e diga *"/handoff e faça push"*: ele envia a branch atual depois da verificação de segredos, nunca com `--force`, e pergunta antes se for a branch padrão.

## Instalação

**Plugin do Claude Code** (inclui o aviso no início da sessão):

```
/plugin marketplace add asalazarvaldiviaocg/handoff
/plugin install handoff@handoff
```

**Qualquer agente que leia `SKILL.md`** (Claude Code, Codex, Cursor, Gemini CLI e outros), com a [CLI de skills](https://skills.sh):

```
npx skills add asalazarvaldiviaocg/handoff
```

**Manual:** copie uma pasta.

```bash
git clone https://github.com/asalazarvaldiviaocg/handoff
mkdir -p ~/.claude/skills && cp -r handoff/skills/handoff ~/.claude/skills/
```

```powershell
# Windows PowerShell
git clone https://github.com/asalazarvaldiviaocg/handoff
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse handoff\skills\handoff "$HOME\.claude\skills\"
```

Os scripts auxiliares, a busca por segredos e o aviso no início da sessão precisam do **Node 18+** no seu PATH. Sem o Node, o skill usa comandos `git` comuns e avisa que a busca por segredos e o verificador foram pulados.

## Por que não usar só `/compact` ou `claude --resume`?

Eles resolvem outros problemas. Use-os também.

| | `/compact` | `claude --resume` | `/handoff` |
|---|---|---|---|
| Um colega ou outro agente consegue retomar | Não | Não, é a sua transcrição | **Sim, é um arquivo comum: compartilhe-o ou guarde os handoffs em uma pasta sincronizada** |
| Outra máquina consegue retomar | Não | Só se você copiar a transcrição | **Com uma pasta sincronizada e `/handoff e faça push`** |
| Espera revisões, workflows e testes em andamento | Não | Não | **Sim** |
| Deixa seu trabalho commitado | Não | Não | **Sim, localmente** |
| Mantém um registro à parte do que falhou | Às vezes, dentro de um resumo | Enterrado na transcrição | **Seção 4** |
| Custo para retomar no dia seguinte | n/a | Recarrega a conversa inteira | **Lê um arquivo de poucos KB** |
| É verificado quanto a lacunas antes de você depender dele | Não | Não | **Verificador** |

**Outros skills de handoff** costumam só escrever um arquivo de resumo. Este também espera o trabalho em andamento, faz commit WIP por repositório, deixa em paz os arquivos dos outros, valida a própria saída e se anuncia para a próxima sessão. Ele não dispara sozinho em determinada porcentagem de uso; se quiser isso, faça sua status line ou um hook dizer ao agente para rodar `/handoff` por volta de 90%.

## O que ele nunca faz

- **Deploy.** Nunca. Em vez disso, escreve na seção 5 o comando exato e o rollback.
- **Push sem você pedir.** Só *"/handoff e faça push"* (ou o seu OK naquele turno) faz isso, e um segredo encontrado em um commit não enviado o bloqueia.
- **Mexer em arquivos que não editou.** Faz commit dos seus próprios arquivos por nome, nunca `git add -A`. Todo outro arquivo modificado é listado e deixado em paz; arquivos intocados desde o início da sessão são sinalizados como provavelmente de outra pessoa.
- **Deixar um segredo passar em silêncio.** Antes do commit, ele examina as mudanças, os arquivos novos e cada commit que ainda não está no remoto (um por um, então uma chave adicionada e depois apagada ainda conta), sinaliza arquivos `.env` que não estão no `.gitignore` e examina o `HANDOFF.md` antes de entregá-lo a você.
- **Colocar o `HANDOFF.md` no seu histórico.** Ele vai para `.git/info/exclude`, que é local e não altera nenhum arquivo versionado.

## Configuração

**Onde o handoff fica.** Por padrão, `HANDOFF.md` na raiz do repositório em que você estava trabalhando. Para guardá-los em um lugar que sincroniza entre máquinas (um vault do Obsidian, uma pasta compartilhada), adicione uma linha ao seu `CLAUDE.md` ou `AGENTS.md`:

```
Handoffs go to: /Users/voce/notas/handoffs/HANDOFF.md
```

Para que o aviso no início da sessão também procure ali, defina `HANDOFF_PATH` com esse caminho absoluto, no perfil do seu shell ou no bloco `env` de `~/.claude/settings.json`.

**Desligar o aviso.** Defina `HANDOFF_NOTICE=off` da mesma forma.

## O que vem na caixa

```
skills/handoff/
├── SKILL.md                         o procedimento que o agente segue
├── references/
│   ├── stopping-boundary.md         o que fazer com cada tipo de trabalho em andamento
│   ├── handoff-template.md          o template de 5 seções
│   └── example-handoff.md           um handoff realista já preenchido
└── scripts/
    ├── repo-state.mjs               branch, HEAD, arquivos modificados, commits não enviados, segredos
    └── check-handoff.mjs            o verificador do handoff (--minimal para a versão curta)
hooks/session-start.mjs              aviso "Handoff waiting" ao iniciar a sessão
tests/run.mjs                        57 testes de regressão (node tests/run.mjs)
```

## Perguntas frequentes

**Funciona fora do Claude Code?** O skill é um `SKILL.md` padrão, então qualquer agente com suporte a Agent Skills consegue executá-lo. O aviso no início da sessão é um hook do Claude Code; em outros agentes, basta dizer "continue from HANDOFF.md".

**Ele vai colocar o `HANDOFF.md` no meu repositório?** Não. Ele fica excluído localmente. Se você *quiser* versioná-lo, diga isso no seu `CLAUDE.md`.

**E se algo ainda estiver rodando quando eu o chamar?** Ele espera essa unidade terminar e não começa nada novo. Diga *"pare agora"* e ele não espera nada: interrompe tudo e registra o que foi interrompido.

**Estou com 99% de uso. Dá tempo?** Modo mínimo: primeiro o commit local, depois um handoff de 20 a 40 linhas com o objetivo, os HEADs e três próximos passos, salvo e validado (`--minimal`). As seções 3 e 4 vêm depois, se sobrar orçamento.

**Quantos tokens custa?** Carregar o skill custa cerca de 5,5k tokens. Os três arquivos de referência que ele lê pelo caminho somam cerca de 4,4k. Além disso: alguns comandos `git`, a execução dos testes se for rápida e a escrita do handoff em si, geralmente alguns milhares de tokens. O modo mínimo pula quase tudo isso.

## De onde veio

Começou como um skill privado para um ambiente que derruba sessões o tempo todo: duas máquinas, um vault de notas compartilhado e limites de uso que chegam no meio da tarefa. A maioria das regras vem de algo que deu errado:

- **"Espere a revisão em andamento"**: uma revisão de código com vários agentes foi cortada quando só faltava o relatório final.
- **"Leia a documentação oficial antes de projetar em torno de um limite"** (o tipo de linha para o qual a seção 4 existe): um timeout de dez segundos lembrado de uma resposta de fórum causou quatro bugs. O limite real era de sessenta.
- **"Escreva o handoff com a ferramenta de arquivos, não com um heredoc de shell"**: vinte kilobytes de markdown com aspas e barras invertidas quebraram o heredoc duas vezes.
- **"Anuncie antes da primeira chamada de ferramenta"**: nos testes, o agente continuava pulando a única linha que o usuário precisa ouvir, até que a instrução foi movida para a descrição do skill.

No meu próprio teste lado a lado com dois cenários de encerramento, o mesmo modelo com a versão original do skill cumpriu todos os 69 itens da rubrica; sem ele, 55. Não guardei esse conjunto de testes, então leia isso como uma anedota, não como um benchmark. Antes deste lançamento, a versão pública foi executada de ponta a ponta em repositórios descartáveis, duas vezes, e seus scripts passam nos 57 testes de regressão em [`tests/`](tests/run.mjs), cada um construído a partir de um bug que essas execuções encontraram.

## Contribuindo

Issues e pull requests são bem-vindos, especialmente novas linhas para o [limite de parada](skills/handoff/references/stopping-boundary.md) vindas de ambientes que ele ainda não conhece. Veja [CONTRIBUTING.md](CONTRIBUTING.md).

Tem uma seção 4 que te poupou uma tarde? Compartilhe nas [Discussions](https://github.com/asalazarvaldiviaocg/handoff/discussions), sem os segredos.

---

<p align="center">
  Se o <code>/handoff</code> salvou uma sessão sua, uma ⭐ ajuda a próxima pessoa a encontrá-lo.<br>
  <sub>Licença MIT. Feito com Claude Code.</sub>
</p>