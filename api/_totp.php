<?php
/**
 * ════════════════════════════════════════════════════════════
 *  TOTP (RFC 6238) – Minimale Implementierung für 2FA
 *  Kompatibel mit Google Authenticator, Authy, 1Password etc.
 *  Keine externen Dependencies.
 * ════════════════════════════════════════════════════════════
 */
declare(strict_types=1);

/**
 * Generiert ein neues TOTP-Secret (Base32-kodiert).
 * Default: 20 Bytes = 160 Bit Entropie (Empfehlung RFC 4226).
 */
function totpGenerateSecret(int $bytes = 20): string {
    return base32Encode(random_bytes($bytes));
}

/**
 * Erzeugt den aktuellen 6-stelligen TOTP-Code für ein Secret.
 * @param string $secret   Base32-kodiertes Secret
 * @param int    $period   Zeitfenster in Sekunden (default 30)
 * @param int    $digits   Code-Länge (default 6)
 * @param int|null $timestamp  Falls null → time()
 */
function totpCode(string $secret, int $period = 30, int $digits = 6, ?int $timestamp = null): string {
    $timestamp = $timestamp ?? time();
    $counter = (int)floor($timestamp / $period);

    // Counter als 8-Byte Big-Endian
    $binCounter = pack('N*', 0) . pack('N*', $counter);

    $key  = base32Decode($secret);
    $hash = hash_hmac('sha1', $binCounter, $key, true);

    // Dynamic Truncation (RFC 4226)
    $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
    $bin    = (ord($hash[$offset    ]) & 0x7F) << 24
            | (ord($hash[$offset + 1]) & 0xFF) << 16
            | (ord($hash[$offset + 2]) & 0xFF) << 8
            | (ord($hash[$offset + 3]) & 0xFF);

    $code = $bin % (10 ** $digits);
    return str_pad((string)$code, $digits, '0', STR_PAD_LEFT);
}

/**
 * Validiert einen TOTP-Code mit ±1 Zeitfenster Toleranz
 * (deckt leichte Uhr-Drift ab).
 */
function totpVerify(string $secret, string $code, int $window = 1, int $period = 30, int $digits = 6): bool {
    $code = preg_replace('/\D/', '', $code);
    if (strlen($code) !== $digits) return false;

    $now = time();
    for ($i = -$window; $i <= $window; $i++) {
        $candidate = totpCode($secret, $period, $digits, $now + ($i * $period));
        if (hash_equals($candidate, $code)) return true;
    }
    return false;
}

/**
 * Otpauth-URI für QR-Code (kann mit jeder Authenticator-App gescannt werden).
 *   otpauth://totp/<issuer>:<account>?secret=...&issuer=<issuer>
 */
function totpUri(string $secret, string $account, string $issuer): string {
    return sprintf(
        'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
        rawurlencode($issuer),
        rawurlencode($account),
        $secret,
        rawurlencode($issuer)
    );
}

/**
 * Backup-Codes generieren (8 × 8-stellige Codes).
 * Werden gehasht gespeichert; einmaliger Verbrauch.
 */
function totpBackupCodes(int $count = 8): array {
    $codes = [];
    for ($i = 0; $i < $count; $i++) {
        // 8 hex chars, in 2x4 Format
        $raw = bin2hex(random_bytes(4));
        $codes[] = strtoupper(substr($raw, 0, 4) . '-' . substr($raw, 4, 4));
    }
    return $codes;
}

// ─── Base32 (RFC 4648) ──────────────────────────────────────

function base32Encode(string $bin): string {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $out = '';
    $buffer = 0;
    $bits = 0;
    for ($i = 0, $n = strlen($bin); $i < $n; $i++) {
        $buffer = ($buffer << 8) | ord($bin[$i]);
        $bits += 8;
        while ($bits >= 5) {
            $bits -= 5;
            $out .= $alphabet[($buffer >> $bits) & 0x1F];
        }
    }
    if ($bits > 0) {
        $out .= $alphabet[($buffer << (5 - $bits)) & 0x1F];
    }
    return $out;
}

function base32Decode(string $b32): string {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $b32 = strtoupper(preg_replace('/[^A-Z2-7]/', '', $b32));
    $out = '';
    $buffer = 0;
    $bits = 0;
    for ($i = 0, $n = strlen($b32); $i < $n; $i++) {
        $val = strpos($alphabet, $b32[$i]);
        if ($val === false) continue;
        $buffer = ($buffer << 5) | $val;
        $bits += 5;
        if ($bits >= 8) {
            $bits -= 8;
            $out .= chr(($buffer >> $bits) & 0xFF);
        }
    }
    return $out;
}
