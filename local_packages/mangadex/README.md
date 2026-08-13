
---

# 📚 MangaDex Scraper – 𝒀𝑨𝑲𝑨𝑴𝒀 (PT-BR)

Scraper de **mangás e manhuas em português (PT-BR)** utilizando a **API oficial do MangaDex**, integrado à **𝒀𝑨𝑲𝑨𝑴𝒀 (WhatsApp)** com **Baileys**.

Compatível com **Node.js – 2025/2026** ✅

---

## 🚀 Funcionalidades

* 🔎 Buscar mangás em **português**
* 📚 Listar capítulos disponíveis (PT-BR)
* 🖼️ Ler capítulos por imagens
* 📄 Gerar e enviar **PDF do capítulo**
* 🧠 Cache por usuário (sem conflito em grupos)
* 📲 Suporte a **botões e listas (Baileys)**
* ⚡ Sem necessidade de API Key (MangaDex é gratuito)

---

## 🛠️ Tecnologias usadas

* **Node.js**
* **Axios**
* **Baileys**
* **PDFKit**
* **File System (fs)**
* **MangaDex API (oficial)**

---

## 📦 Estrutura do Scraper

```
📁 mangadex/
 ├─ mangadex.js        # Funções de busca e capítulos
 ├─ pdf.js             # Gerador de PDF
 ├─ cache.js           # Cache por usuário
 └─ utils.js           # Funções auxiliares
```

---

## 📥 Instalação

Instale as dependências necessárias:

```bash
npm install axios pdfkit fs
```

(Se estiver usando Baileys, ele já deve estar instalado)

---

## 📌 Comandos disponíveis

### 🔍 Buscar mangá

```
$manga nome_do_manga
```

### 📚 Listar capítulos

```
$cap
```

### 📖 Ler capítulo (imagens)

```
$lercap número
```

### 📄 Gerar PDF do capítulo

```
$lerpdf
```

---

## 🧠 Cache (Importante)

O scraper usa cache global por chat:

```js
global.lastManga = {}
global.capCache = {}
global.lastChapter = {}
```

Isso evita:

* Conflito entre usuários
* Erros em grupos
* Capítulos errados

---

## 📄 Geração de PDF

* Cada página do capítulo vira uma página no PDF
* Nome automático do arquivo
* Enviado como **document/pdf** no WhatsApp

Exemplo:

```
Capitulo_12.pdf
```

---

## ⚠️ Aviso Legal (Disclaimer)

Este projeto:

* ❌ **Não hospeda mangás**
* ❌ **Não armazena conteúdo**
* ✅ Apenas consome a **API oficial do MangaDex**

O autor **não se responsabiliza** por:

* Uso indevido
* Violação de termos de terceiros
* Banimento de contas
* Uso comercial não autorizado

---

## 🔒 Licença

Este projeto usa uma **licença restritiva personalizada**:

* 🚫 Proibida revenda
* 🚫 Proibido repasse
* 🚫 Proibido publicar ou redistribuir
* ✅ Uso apenas pessoal / interno

Veja o arquivo **`LICENSE`** para mais detalhes.

---

## 👑 Autor

**RAI DEV**
WhatsApp Bot Developer
𝒀𝑨𝑲𝑨𝑴𝒀 • Scrapers • APIs • Automação

> © 2026 – Todos os direitos reservados

---
