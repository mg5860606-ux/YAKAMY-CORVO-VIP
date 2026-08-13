<div align="center">
  <!-- Título com ênfase e separador visual -->
  <img src="https://raw.githubusercontent.com/Otakump4/links-gerados/main/IMAGENS/efibank.jpeg" alt="PIX Logo" width="150">
  <h1>EfiPayPayment</h1>
  <h3>Integração Simples e Eficiente com a Efí Pay (PIX)</h3>
</div>

<div align="center">
  <!-- Badges com estilo 'for-the-badge' e mais cores -->
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License MIT">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Ef%C3%AD%20Pay-API-orange?style=for-the-badge" alt="Efí Pay API">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge" alt="Status Active">
  <img src="https://img.shields.io/badge/PRs-Welcome-blueviolet?style=for-the-badge" alt="PRs Welcome">
</div>

<br>

---

<br>

O **EfiPayPayment** é a solução definitiva em Node.js para quem busca uma integração **rápida, segura e robusta** com a API da **Efí Pay**. Gerencie todo o ciclo de vida de pagamentos via **PIX** em suas aplicações, desde a criação da cobrança até a consulta de status em tempo real.

<br>

---

<h2 align="center">🚀 Comece em Minutos</h2>

<div align="center">
  <!-- Estrutura de colunas para a instalação -->
  <table>
    <tr>
      <td align="center" width="33%">
        <h3>1. Clone</h3>
        <p>Baixe o código-fonte do repositório.</p>
        <pre><code>git clone https://github.com/Otakump4/gerencianet-module.git</code></pre>
      </td>
      <td align="center" width="33%">
        <h3>2. Navegue</h3>
        <p>Acesse o diretório do projeto.</p>
        <pre><code>cd gerencianet-module</code></pre>
      </td>
      <td align="center" width="33%">
        <h3>3. Instale</h3>
        <p>Instale as dependências necessárias.</p>
        <pre><code>npm install</code></pre>
      </td>
    </tr>
  </table>
</div>

---

<h2 align="center">✨ Funcionalidades de Destaque</h2>

<div align="center">
  <!-- Uso de blocos de citação para simular "cards" de funcionalidades -->
  <table width="100%">
    <tr>
      <td width="50%" valign="top">
        <blockquote>
          <h3>💸 Criação Instantânea de PIX</h3>
          <p>Gere cobranças PIX de forma instantânea e com valores customizáveis. Suporte completo à API da Efí Pay para transações seguras.</p>
        </blockquote>
      </td>
      <td width="50%" valign="top">
        <blockquote>
          <h3>📱 QR Code e Copia e Cola</h3>
          <p>Obtenha o QR Code estático e o código "Copia e Cola" (Pix Copia e Cola) prontos para serem exibidos ao usuário.</p>
        </blockquote>
      </td>
    </tr>
    <tr>
      <td width="50%" valign="top">
        <blockquote>
          <h3>🔍 Monitoramento em Tempo Real</h3>
          <p>Consulte o status de cada transação PIX e utilize o recurso de Polling para monitorar pagamentos automaticamente.</p>
        </blockquote>
      </td>
      <td width="50%" valign="top">
        <blockquote>
          <h3>📤 Webhook Ready</h3>
          <p>Funcionalidade de envio automático do QR Code para um servidor externo, facilitando a integração com sistemas de Webhook e notificações.</p>
        </blockquote>
      </td>
    </tr>
  </table>
</div>

---

## ⚙️ Configuração

Para iniciar, você precisa das credenciais da API da **Efí Pay**.

```javascript
const { EfiPayPayment } = require('./EfiPayPayment');

// Configurando a API com sua chave PIX
const efipay = new EfiPayPayment('sua-chave-pix-aqui');
```

> 🔑 **Autenticação Segura**: Garanta que o certificado `producao_zerotwo.p12` esteja no diretório raiz do projeto para que a autenticação com a API seja realizada com sucesso.

---

## 📖 Exemplos de Uso

A documentação completa e mais exemplos podem ser encontrados na pasta `examples/`.

### 1. Criar um Pagamento via Pix

```javascript
(async () => {
  // Valor em centavos (ex: 10000 = R$ 100,00)
  const valorEmCentavos = 10000; 
  const payment = await efipay.createPixPayment(valorEmCentavos); 
  
  if (payment) {
    console.log('QR Code:', payment.qr_code);
    console.log('Pix Copia e Cola:', payment.pix_copia_e_cola);
    console.log('Imagem do QR Code (URL):', payment.uploaded_image_url);
  } else {
    console.log('Erro ao criar o pagamento.');
  }
})();
```

### 2. Consultar Status de Pagamento

```javascript
(async () => {
  const txid = 'id_do_pagamento'; // Substitua pelo TXID do pagamento
  const status = await efipay.checkPayment(txid); 
  console.log('Status do pagamento:', status);
})();
```

---

<h2 align="center">🛠️ Tecnologias e Dependências</h2>

<div align="center">
  <!-- Badges das tecnologias utilizadas -->
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=Node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Ef%C3%AD%20Pay-API-orange?style=flat-square" alt="Efí Pay API">
  <img src="https://img.shields.io/badge/SDK-sdk--node--apis--efi-blue?style=flat-square" alt="SDK Efí">
  <img src="https://img.shields.io/badge/QR%20Code-qrcode-lightgrey?style=flat-square" alt="QR Code">
</div>

---

<h2 align="center">🤝 Contribuição e Suporte</h2>

<div align="center">
  <table width="100%">
    <tr>
      <td width="50%" valign="top">
        <h3>🌟 Contribua</h3>
        <p>Sua contribuição é muito bem-vinda! Sinta-se à vontade para abrir um <strong>pull request</strong> ou reportar problemas na aba de <strong>issues</strong>.</p>
      </td>
      <td width="50%" valign="top">
        <h3>📞 Suporte</h3>
        <p>Em caso de dúvidas ou necessidade de suporte, entre em contato com o desenvolvedor:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:lucasmoddomina@gmail.com">lucasmoddomina@gmail.com</a></li>
          <li><strong>GitHub:</strong> <a href="https://github.com/Otakump4">Otakump4</a></li>
        </ul>
      </td>
    </tr>
  </table>
</div>

---

<div align="center">
  <p>
    <strong>Licença:</strong> Este projeto está licenciado sob a <a href="LICENSE">Licença MIT</a>.
  </p>
  <p>
    <strong>Feito com ❤️ para simplificar seus pagamentos PIX.</strong>
  </p>
</div>
