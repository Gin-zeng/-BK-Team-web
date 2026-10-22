/** 调用 DeepSeek Chat Completions（OpenAI 兼容）。密钥来自 env.DEEPSEEK_API_KEY。 */
export async function askDeepSeek(
  env: { DEEPSEEK_API_KEY?: string },
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('未配置 AI 密钥');
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 600, temperature: 0.4 }),
  });
  if (!res.ok) throw new Error('AI 服务暂不可用（' + res.status + '）');
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI 未返回内容');
  return text;
}
