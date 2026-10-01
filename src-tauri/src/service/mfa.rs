use data_encoding::BASE32_NOPAD;
use rand::Rng;
use totp_lite::{totp_custom, Sha1};

/// TOTP 时间步长（秒）。
const TOTP_STEP: u64 = 30;
/// TOTP 验证码位数。
const TOTP_DIGITS: u32 = 6;

/// 用途: 生成新的 TOTP 密钥; 输入: 无; 输出: Base32 字符串; 必要性: 用户开启 MFA 时需要该密钥。
///
/// 注意: 必须使用 Base32 (RFC 4648, 无填充) 编码, 才能与 Google Authenticator、
/// 1Password、Authy 等标准验证器以及 otpauth:// URI 兼容。
pub fn generate_secret() -> Result<String, String> {
    let mut rng = rand::thread_rng();
    let secret: [u8; 20] = rng.gen();
    Ok(BASE32_NOPAD.encode(&secret))
}

/// 用途: 将用户输入的 MFA 密钥规范化为标准 Base32 字节;
///       输入: 可能包含空格、短横线、小写字母或 '=' 填充的密钥;
///       输出: 解码后的字节; 必要性: 兼容各种验证器导出的格式。
fn decode_secret(secret: &str) -> Result<Vec<u8>, String> {
    // 去除所有空白、短横线和填充，并统一转大写
    let normalized: String = secret
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-' && *c != '=')
        .collect::<String>()
        .to_ascii_uppercase();

    if normalized.is_empty() {
        return Err("empty_mfa_secret".to_string());
    }

    BASE32_NOPAD
        .decode(normalized.as_bytes())
        .map_err(|e| format!("decode_secret_failed: {}", e))
}

/// 用途: 验证用户提交的 TOTP; 输入: 密钥与 token; 输出: bool; 必要性: 登录二次验证依赖它。
pub fn verify_token(secret: &str, token: &str) -> Result<bool, String> {
    let secret_bytes = decode_secret(secret)?;
    let token = token.trim();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system_time_error: {}", e))?
        .as_secs();

    // 允许前后各一个时间窗口的漂移（±30 秒）
    for offset in [-1i64, 0, 1] {
        let test_time = (timestamp as i64 + offset * TOTP_STEP as i64) as u64;
        let generated = totp_custom::<Sha1>(TOTP_STEP, TOTP_DIGITS, &secret_bytes, test_time);

        if format!("{:0width$}", generated, width = TOTP_DIGITS as usize) == token {
            return Ok(true);
        }
    }

    Ok(false)
}

/// 用途: 根据密钥生成当前 TOTP; 输入: Base32 密钥; 输出: 六位字符串; 必要性: 前端显示验证码。
pub fn generate_totp(secret: &str) -> Result<String, String> {
    let secret_bytes = decode_secret(secret)?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system_time_error: {}", e))?
        .as_secs();

    let code = totp_custom::<Sha1>(TOTP_STEP, TOTP_DIGITS, &secret_bytes, timestamp);
    Ok(format!("{:0width$}", code, width = TOTP_DIGITS as usize))
}

/// 用途: 生成下一组 TOTP 验证码; 输入: Base32 密钥; 输出: 六位字符串; 必要性: 预告下一组验证码。
pub fn generate_next_totp(secret: &str) -> Result<String, String> {
    let secret_bytes = decode_secret(secret)?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system_time_error: {}", e))?
        .as_secs();

    // 下一组验证码使用下一个 30 秒时间窗口
    let next_timestamp = timestamp + TOTP_STEP;
    let code = totp_custom::<Sha1>(TOTP_STEP, TOTP_DIGITS, &secret_bytes, next_timestamp);
    Ok(format!("{:0width$}", code, width = TOTP_DIGITS as usize))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_base32_with_and_without_noise() {
        // "12345678901234567890" 的 Base32 编码
        let secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        assert!(decode_secret(secret).is_ok());
        assert!(decode_secret("gezd gnbv-gy3tqojqgezdgnbvgy3tqojq=").is_ok());
        assert_eq!(
            decode_secret(secret).unwrap(),
            decode_secret("gezd gnbv-gy3tqojqgezdgnbvgy3tqojq=").unwrap()
        );
    }

    #[test]
    fn rejects_empty_secret() {
        assert!(decode_secret("   ").is_err());
    }

    #[test]
    fn generated_secret_round_trips() {
        let secret = generate_secret().unwrap();
        // 生成的密钥应当是可被标准验证器识别的 Base32
        assert!(decode_secret(&secret).is_ok());

        let code = generate_totp(&secret).unwrap();
        assert_eq!(code.len(), 6);
        assert!(verify_token(&secret, &code).unwrap());
    }

    #[test]
    fn accepts_noisy_user_input() {
        let secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        let code = generate_totp(secret).unwrap();
        let noisy = format!("  {}  ", secret.to_lowercase());
        assert!(verify_token(&noisy, &code).unwrap());
    }
}