export const PROVIDER_CATALOG={
  openai:{family:"openai-compatible",env:"OPENAI_API_KEY"},
  anthropic:{family:"native",env:"ANTHROPIC_API_KEY"},
  google:{family:"native",env:"GEMINI_API_KEY"},
  xai:{family:"openai-compatible",env:"XAI_API_KEY"},
  nvidia:{family:"openai-compatible",env:"NVIDIA_API_KEY"},
  groq:{family:"openai-compatible",env:"GROQ_API_KEY"},
  deepseek:{family:"openai-compatible",env:"DEEPSEEK_API_KEY"},
  mistral:{family:"openai-compatible",env:"MISTRAL_API_KEY"},
  openrouter:{family:"openai-compatible",env:"OPENROUTER_API_KEY"},
  ollama:{family:"openai-compatible",env:null},
  cohere:{family:"openai-compatible",env:"COHERE_API_KEY"},
  together:{family:"openai-compatible",env:"TOGETHER_API_KEY"}
};
export function detectProvider({baseUrl="",model=""}={}){
  const s=(baseUrl+" "+model).toLowerCase();
  if(s.includes("anthropic"))return"anthropic";
  if(s.includes("generativelanguage")||s.includes("gemini"))return"google";
  if(s.includes("x.ai")||s.includes("grok"))return"xai";
  if(s.includes("nvidia"))return"nvidia";
  if(s.includes("groq"))return"groq";
  if(s.includes("deepseek"))return"deepseek";
  if(s.includes("mistral"))return"mistral";
  if(s.includes("openrouter"))return"openrouter";
  if(s.includes("ollama"))return"ollama";
  if(s.includes("openai"))return"openai";
  return"generic-openai-compatible";
}