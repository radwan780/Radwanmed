import { GoogleGenAI, Modality, Part, GenerateContentResponse } from "@google/genai";
import { ImageFile } from '../types';

/**
 * تهيئة العميل باستخدام مفتاح API من متغيرات البيئة.
 * هذا يضمن أمان المفتاح عند نشر الموقع للجمهور.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY غير موجود. يرجى ضبطه في إعدادات البيئة (Environment Variables).");
  }
  return new GoogleGenAI({ apiKey });
};

export async function generateImage(
  productImage: ImageFile,
  prompt: string,
  styleImage: ImageFile | null
): Promise<ImageFile> {
  const ai = getAIClient();
  // استخدام موديل gemini-2.5-flash-image المستقر لتوليد الصور
  const model = 'gemini-2.5-flash-image';

  const parts: Part[] = [
    {
      inlineData: {
        data: productImage.base64,
        mimeType: productImage.mimeType,
      },
    },
    { text: prompt },
  ];

  if (styleImage) {
    parts.push({
      inlineData: {
        data: styleImage.base64,
        mimeType: styleImage.mimeType,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
          name: 'generated-image.png',
        };
      }
    }
    
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        throw new Error(`فشل التوليد: ${finishReason}`);
    }

    throw new Error('لم يتم إرجاع صورة من المحرك الذكي.');

  } catch (error) {
    console.error('Gemini Execution Error:', error);
    throw new Error('حدث خطأ في الاتصال بالمحرك. تأكد من صلاحية مفتاح API المضاف في إعدادات النشر.');
  }
}

export async function analyzeStyleImage(styleImage: ImageFile): Promise<string> {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview'; 
  
  const imagePart = {
    inlineData: {
      data: styleImage.base64,
      mimeType: styleImage.mimeType,
    },
  };
  
  const textPart = {
    text: "وصف جماليات هذه الصورة (الإضاءة، النمط، الألوان) لاستخدامها كمرجع لتوليد صور منتجات مشابهة. اجعل الرد باللغة العربية وموجز جداً.",
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: [imagePart, textPart] },
    });
    
    return response.text?.trim() || "نمط استوديو احترافي";

  } catch (error) {
    console.error('Style Analysis Error:', error);
    throw new Error('فشل تحليل النمط.');
  }
}