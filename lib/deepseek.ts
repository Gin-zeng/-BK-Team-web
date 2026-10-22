/** 调用 DeepSeek Chat Completions（OpenAI 兼容）。密钥来自 env.DEEPSEEK_API_KEY。json=true 时启用 JSON 输出模式。 */
export async function askDeepSeek(
  env: { DEEPSEEK_API_KEY?: string },
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  json = false,
): Promise<string> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('未配置 AI 密钥');
  const body: any = { model: 'deepseek-chat', messages, max_tokens: json ? 800 : 600, temperature: 0.4 };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error('AI 服务暂不可用（' + res.status + '）');
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI 未返回内容');
  return text;
}
