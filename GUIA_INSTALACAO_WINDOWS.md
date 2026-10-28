# Guia de Instalação no Windows Desktop & Base de Dados em Excel de Rede

Este documento explica como utilizar o **REC - Gestor de Contratos** como **aplicação para Desktop Windows** e ligar a base de dados a um ficheiro **Excel (.xlsx)** numa pasta partilhada do servidor do seu local de trabalho.

---

## Opção 1: Instalação Direta no Windows (PWA Desktop - Mais Simples e Recomendada)

A aplicação está configurada como uma **Aplicação Desktop Nativa (PWA)** para Windows. Não necessita de privilégios de administrador de TI para instalar.

### Como Instalar:
1. Abra a aplicação no **Microsoft Edge** ou **Google Chrome** no seu computador Windows.
2. No topo direito do ecrã, clique no botão **"Instalar no Windows"** (ou no ícone de monitor com seta que surge na barra de endereço do navegador).
3. No diálogo que aparece, clique em **"Instalar"**.
4. **Pronto!** A aplicação:
   - Ganha um atalho oficial no seu **Ambiente de Trabalho** e no **Menu Iniciar do Windows**.
   - Abre numa **janela própria e independente do Windows** (sem barras de navegação nem separadores de browser).
   - Fica integrada na barra de tarefas do Windows.

---

## Opção 2: Ligação à Base de Dados em Excel no Servidor de Rede

Pode utilizar um ficheiro `.xlsx` localizado numa pasta de rede da sua organização (ex.: `Z:\Contratos\contratos.xlsx` ou `\\servidor\partilha\contratos.xlsx`) como a base de dados central dos contratos.

### Passo a Passo para Configurar a Pasta do Servidor:
1. Na barra superior da aplicação, clique em **"Base de Dados: Excel Servidor"** (ícone da folha de cálculo verde).
2. Clique em **"Selecionar no Servidor"**.
3. O Windows Explorer irá abrir:
   - Navegue até à unidade de rede (ex.: `Z:\` ou `\\nome-do-servidor\pasta`).
   - Selecione o ficheiro de Excel com os contratos (ou crie um novo com o botão **"Criar Novo no Servidor"**).
4. Confirme a permissão de leitura/gravação quando o Windows solicitar.

### Vantagens do Modo Excel no Servidor:
- **Gravação Automática em Tempo Real**: Sempre que criar, editar ou alterar o estado de um contrato, a aplicação regrava diretamente o ficheiro Excel no servidor de rede.
- **Sincronização com Colegas**: Se outro utilizador alterar o ficheiro Excel no servidor, basta clicar no botão **"Ler do Servidor"** para recarregar todos os dados.
- **Suporte Total ao "Link P & D"**: O novo campo de hiperligação *Link P & D* é gravado e lido do Excel como qualquer outro campo.
- **Cópias de Segurança / Backups**: Pode gerar cópias de segurança datadas para arquivamento com um só clique.

---

## Opção 3: Empacotamento como Executável (.exe) Nativo via Electron

Se a equipa de informática pretender gerar um ficheiro executável `.exe` independente:

1. No terminal do projeto, instale o Electron e Electron Builder:
   ```bash
   npm install --save-dev electron electron-builder
   ```
2. Para testar a aplicação em modo Desktop localmente:
   ```bash
   npm run electron:dev
   ```
3. Para gerar o instalador `.exe` para Windows:
   ```bash
   npm run electron:build
   ```
   O instalador `REC-Contratos-Setup.exe` será gerado na pasta `dist-electron/`.
