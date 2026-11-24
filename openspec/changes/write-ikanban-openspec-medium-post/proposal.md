# Proposal

## Why

Criar um post em português, com linguagem clara e honesta, sobre como o iKanban pode organizar o trabalho de uma pessoa desenvolvedora em conjunto com o OpenSpec e uma LLM. O texto deve explicar por que registrar apenas o que foi feito e o que falta em um único arquivo `.md` é útil, mas insuficiente para explorar ideias, preservar contexto, orientar a implementação e validar o resultado.

## What Changes

- Criar um artigo em Markdown na raiz do projeto, pronto para adaptação ou publicação no Medium.
- Explicar a diferença entre:
  - usar apenas um arquivo `.md` como lista narrativa de tarefas;
  - usar o iKanban para organizar tarefas por prioridade e estado;
  - usar o OpenSpec para registrar contexto, intenção, requisitos, decisões e plano antes da implementação.
- Descrever os benefícios práticos da combinação iKanban + OpenSpec + LLM, sem prometer automação ou resultados que a ferramenta não oferece.
- Explicar que o iKanban é local-first, baseado em arquivos legíveis e sem depender de servidor, conta ou cota de serviço externo.
- Apresentar a skill do iKanban como um contrato operacional que orienta agentes a criar, atualizar, mover e validar tarefas com segurança.
- Incluir uma comparação honesta com Trello, Asana, Linear e GitHub Projects, reconhecendo que essas ferramentas são fortes para equipes e gestão compartilhada.
- Explicar as limitações da abordagem local e do uso de LLMs de baixo custo, incluindo a necessidade de revisar contexto, decisões e resultados.
- Registrar a experiência do autor com o modelo DeepSeek V4.1 Flash 1017 como exemplo de uso de uma LLM de baixo custo, sem transformar essa experiência em garantia de desempenho.
- Tratar testes automatizados como padrão de implementação e como evidência de que uma tarefa foi realmente validada, não apenas marcada como concluída.
- Ajustar a opinião fornecida pelo autor para melhorar clareza, coesão, gramática e equilíbrio argumentativo, preservando sua posição.

## Capabilities

### New Capabilities

Nenhuma. Esta é uma mudança editorial/documental; não introduz comportamento de produto nem requisito funcional.

### Modified Capabilities

Nenhuma. As especificações existentes do iKanban não precisam ser alteradas para produzir o artigo.

## Impact

- Novo arquivo Markdown na raiz do repositório, destinado a conteúdo editorial.
- Nenhuma alteração em código, API, dependências, persistência ou comportamento da extensão.
- Nenhuma alteração nas especificações funcionais existentes.
- O artigo deverá ser fundamentado no comportamento documentado atual do iKanban, especialmente seu armazenamento local em YAML, sua skill portátil para agentes e sua suíte de testes.
