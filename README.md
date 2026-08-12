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
- A fonte oficial é o CSV público normalizado da operação; o painel filtra exclusivamente o contrato `TIMBAÚBA`.
- Ao abrir, o painel consulta automaticamente o arquivo e considera a leitura mais recente de cada rota.
- Como o CSV informa passageiros transportados, mas não uma coluna de capacidade, o percentual usa 48 lugares como capacidade operacional de referência.
- Se a planilha estiver indisponível, o painel mantém a última leitura disponível.
