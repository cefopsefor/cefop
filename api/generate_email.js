// api/generate_email.js

import { GoogleGenAI } from '@google/genai';

// Inicializa o cliente do Gemini
const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
}); 

/**
 * Handler para a função serverless do Vercel.
 */
export default async function (req, res) {
    
    // Configurações de CORS e método
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido.' });
        return;
    }

    try {
        // Recebe brief (texto), base64File (conteúdo do arquivo) e mimeType
        const { brief, base64File, mimeType } = req.body || {};

        // Validação de segurança: é obrigatório fornecer texto OU arquivo.
        if (!brief && !base64File) {
            res.status(400).json({ error: 'É obrigatório fornecer o Resumo ou um Arquivo para a geração da mensagem.' });
            return;
        }
        
        // =========================================================================
        // === PREPARAÇÃO DO CONTEÚDO MULTIMODAL PARA A IA ===========================
        // =========================================================================
        
        const contents = [];
        let inputContentReference = '';

        // 1. Adiciona o arquivo (se presente) para análise da IA
        if (base64File && mimeType) {
            contents.push({
                inlineData: {
                    data: base64File,
                    mimeType: mimeType,
                },
            });
            inputContentReference = 'e do arquivo anexo.';
        }
        
        // 2. Define o conteúdo de texto para a IA (o brief do usuário ou um fallback)
        const textToAnalyze = brief || 'As informações devem ser estritamente extraídas do arquivo anexado.';
        
        // =========================================================================
        // === O PROMPT FINAL COM AS 4 ETAPAS E REGRAS DE FORMATAÇÃO (E-MAIL) ========
        // =========================================================================
        const prompt = `
[INSTRUÇÕES DE GERAÇÃO E FORMATAÇÃO]
Você é um assistente de inteligência artificial da Célula de Formação, Programas e Projetos (CEFOP). Sua tarefa é transformar as informações fornecidas (via Resumo de Texto ${inputContentReference}) em um **E-MAIL FORMAL**, profissional e padronizado, seguindo RIGOROSAMENTE as 4 etapas de formatação abaixo.

RESTRIÇÃO DE CONTEÚDO:
Gere o conteúdo da mensagem APENAS com base nas informações que você recebeu (no Resumo do Usuário e/ou no Arquivo). É ESTRITAMENTE PROIBIDO realizar pesquisas externas ou adicionar informações que não estejam presentes no conteúdo fornecido.

ETAPAS DE GERAÇÃO E FORMATAÇÃO:

1ª ETAPA - ASSUNTO (Linha de Assunto do E-mail):
Crie uma frase concisa de até 8 palavras que resuma o ponto principal do conteúdo fornecido. Esta frase deve ser a PRIMEIRA LINHA da sua resposta e deve estar **TODA EM MAIÚSCULO**.

2ª ETAPA - SAUDAÇÃO INICIAL:
Após o Assunto, pule duas linhas. Inicie a mensagem do e-mail com a saudação exata: "Prezados(as) Senhores(as) Diretores(as),".

3ª ETAPA - CORPO DO TEXTO (Comunicação Oficial):
Mantenha um tom de formalidade (comunicações oficiais) e use uma linguagem aprimorada, adequada para um e-mail profissional. O texto deve ser conciso (máximo de 5 parágrafos curtos) e profissional.
O texto DEVE começar com a frase: "Vimos por meio desta, [continue o texto...]"
Transforme o conteúdo fornecido (Resumo e/ou Arquivo) em um corpo de texto coeso, claro e profissional.
Utilize negrito (asteriscos duplos, **) nas informações mais importantes, como prazos ou ações críticas. Use quebras de linha padrão de e-mail.

4ª ETAPA - ENCERRAMENTO PADRONIZADO:
Após o Corpo do Texto (separado por uma ou duas linhas vazias), adicione o encerramento **EXATAMENTE** como especificado abaixo. **IMPORTANTE:** Não utilize formatação de WhatsApp (negrito/itálico).

---
Atenciosamente,

Célula de Formação, Programas e Projetos - CEFOP
Superintendências das Escolas Estaduais de Fortaleza – SEFOR

---
Conteúdo do Usuário para análise (Texto): 
${textToAnalyze}
`;
        
        // 3. Adiciona o prompt ao array de conteúdos
        contents.push({ text: prompt });


        // Chamada à API do Gemini
        const response = await ai.models.generateContent({
            // Modelo multimodal (gemini-2.5-flash) é o ideal para lidar com texto e arquivos.
            model: 'gemini-2.5-flash', 
            contents: contents, 
            config: {
                // Diminui a "criatividade" para garantir um tom formal e padronizado.
                temperature: 0.2, 
            },
        });

        // O texto gerado
        const generatedText = response.text.trim();

        // Retorna o resultado para o frontend
        res.status(200).json({ message: generatedText });

    } catch (error) {
        console.error('Erro ao chamar a API da IA:', error);
        
        let detailedError = 'Falha ao processar a solicitação pela IA. Verifique a GEMINI_API_KEY no Vercel.';

        if (error.message && (error.message.includes('API key not valid') || error.message.includes('403'))) {
            detailedError = 'Erro: Chave API inválida, revogada, ou permissões insuficientes na conta Google.';
        }
        // Em caso de erro de leitura de arquivo ou outro, retorna o erro 500
        res.status(500).json({ error: detailedError });
    }
}