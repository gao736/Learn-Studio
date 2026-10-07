export const localEmailMessage='本机测试模式仅支持 @example.test 测试邮箱。验证链接保存在本机，不会发送到 QQ 等真实邮箱。';
export function isTestEmail(email:unknown):email is string {
  return typeof email==='string'&&/^[^\s@]+@example\.test$/i.test(email.trim());
}
