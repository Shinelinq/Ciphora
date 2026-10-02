/**
 * 密码生成：读取用户设置（长度 / 字符集 / 排除相似字符），
 * 通过后端生成；失败时用同样的设置在前端兜底。
 */

/** 从 settings.passwordGenerator 构造生成参数。 */
export function buildGeneratorOptions(settings) {
  const pg = settings?.passwordGenerator || {};
  return {
    length: pg.defaultLength ?? 16,
    includeUppercase: pg.includeUppercase ?? true,
    includeLowercase: pg.includeLowercase ?? true,
    includeNumbers: pg.includeNumbers ?? true,
    includeSymbols: pg.includeSymbols ?? true,
    excludeSimilar: pg.excludeSimilar ?? false,
    customCharset: pg.customCharset || '',
  };
}

/** 前端兜底生成，遵循同样的设置。 */
export function generateFallbackPassword(options = {}) {
  const length = options.length || 16;
  let charset = (options.customCharset || '').trim();
  if (!charset) {
    charset = [
      options.includeLowercase !== false ? 'abcdefghijklmnopqrstuvwxyz' : '',
      options.includeUppercase !== false ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '',
      options.includeNumbers !== false ? '0123456789' : '',
      options.includeSymbols !== false ? '!@#$%^&*()-_=+[]{}|;:,.<>?' : '',
    ].join('');
  }
  if (options.excludeSimilar) {
    charset = charset.replace(/[0O1lI]/g, '');
  }
  if (!charset) {
    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/** 按设置生成密码；后端返回字符串或 { success, password }。 */
export async function generatePasswordFromSettings(settings) {
  const options = buildGeneratorOptions(settings);
  try {
    const result = await window.api.generatePassword(options);
    const password = typeof result === 'string'
      ? result
      : (result?.success ? result.password : null);
    if (password) return password;
  } catch (error) {
    console.error('生成密码失败，改用本地生成:', error);
  }
  return generateFallbackPassword(options);
}