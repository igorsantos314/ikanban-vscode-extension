# Design

## Context

Conforme descrito em `proposal.md`, a entrega é um artigo editorial em Markdown, não uma alteração funcional no iKanban. O repositório documenta um Kanban local-first que persiste dados em YAML, oferece uma skill portátil para agentes e mantém testes automatizados para o código da extensão. O artigo deve separar claramente esses fatos observáveis da opinião do autor e das conclusões propostas.

## Goals / Non-Goals

**Goals:**

- Organizar o texto com uma progressão simples: problema do arquivo único, papéis do iKanban e do OpenSpec, integração com LLM, benefícios, limites, comparação e testes.
- Usar exemplos concretos do fluxo de trabalho sem inventar integrações online ou automações que o produto não possui.
- Explicar que o iKanban organiza execução e prioridade, enquanto o OpenSpec estrutura entendimento e decisão antes do código.
- Tratar a passagem de tarefa para concluída como insuficiente sem validação; testes devem ser apresentados como parte do padrão de implementação.
- Manter tom pessoal, direto e equilibrado, adequado a um post do Medium.

**Non-Goals:**

- Não alterar código, documentação técnica existente, especificações ou configuração do produto.
- Não apresentar iKanban/OpenSpec como substitutos universais para ferramentas de gestão de equipes.
- Não prometer que uma LLM barata terá a mesma qualidade de modelos maiores ou que elimina revisão humana.
- Não transformar o artigo em tutorial completo de instalação ou em documentação normativa do projeto.

## Decisions

- **Formato em Markdown na raiz:** atende diretamente ao pedido editorial e facilita revisão por Git, cópia para o Medium e colaboração assíncrona. Um novo arquivo será criado apenas durante a aplicação desta proposta.
- **Comparação por responsabilidades:** o artigo diferenciará arquivo `.md`, iKanban e OpenSpec pelo problema que cada um resolve, evitando uma comparação superficial por quantidade de recursos.
- **Exemplos baseados no repositório:** serão usados fatos como YAML local, ausência de servidor/conta, skill portátil e validação/testes. Recursos não observados não serão atribuídos ao produto.
- **Voz autoral revisada:** a experiência do autor será mantida em primeira pessoa, mas com correção gramatical, redução de repetições e reconhecimento explícito das situações em que Trello, Asana, Linear e GitHub Projects são melhores.
- **Testes como critério de conclusão:** o artigo distinguirá “mover uma tarefa para Done” de “entregar uma mudança validada”, recomendando testes automatizados adequados ao comportamento alterado e revisão dos resultados.
- **Menção cautelosa ao modelo:** “DeepSeek V4.1 Flash 1017” será citado como modelo de baixo custo usado pelo autor, acompanhado da ressalva de que custo, disponibilidade e desempenho podem variar.

## Risks / Trade-offs

- **[Risco] O texto pode soar como propaganda → Mitigação:** explicitar limitações, trabalho manual de revisão, ausência de colaboração online nativa e superioridade das ferramentas tradicionais em cenários de equipe.
- **[Risco] Confundir iKanban com OpenSpec → Mitigação:** incluir uma seção ou tabela que contraste estado/prioridade de tarefas com contexto/requisitos/plano.
- **[Risco] Promover o arquivo único como solução inadequada em qualquer caso → Mitigação:** reconhecer que um `.md` é excelente para projetos pequenos, notas rápidas e baixo overhead; a crítica será sobre seus limites conforme a complexidade cresce.
- **[Risco] Tratar testes como garantia absoluta → Mitigação:** dizer que testes aumentam a confiança e detectam regressões, mas não substituem revisão, critérios de aceitação e julgamento técnico.

## Migration Plan

Não há migração técnica. Na aplicação da mudança, criar o arquivo editorial na raiz, revisar o texto e confirmar que nenhum arquivo de código foi modificado.
