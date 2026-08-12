# Painel de Ocupação — Operação Timbaúba

Painel web da Tropical Transportes para acompanhamento da ocupação das rotas da operação Timbaúba.

## Requisitos

- Node.js 20.19 ou superior;
- npm instalado junto com o Node.js;
- conexão com a internet para consultar a planilha publicada e carregar a fonte tipográfica.

## Como executar no Windows

1. Extraia este arquivo `.zip` para uma pasta do computador.
2. Abra o **Prompt de Comando** dentro da pasta extraída.
3. Instale as dependências:

```cmd
npm install
```

4. Inicie o painel:

```cmd
npm run dev
```

5. Abra no navegador o endereço exibido no terminal, normalmente `http://localhost:5173`.

## Como gerar a versão de produção

```cmd
npm run build
```

O resultado será criado na pasta `dist`.

Para testar a versão de produção localmente:

```cmd
npm run preview
```

## Observações

- O arquivo `package-lock.json` acompanha o projeto para reproduzir as versões corretas das dependências.
- A pasta `node_modules` não é incluída no `.zip`, pois ela é específica do sistema operacional e é criada automaticamente pelo comando `npm install`.
- O painel começa com dados demonstrativos e consulta os dados publicados ao clicar em **Atualizar dados**.
