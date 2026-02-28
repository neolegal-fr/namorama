<#macro emailLayout>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject!''}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#10b981;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
              <span style="display:inline-flex;align-items:center;gap:8px;">
                <span style="display:inline-block;width:28px;height:28px;background-color:rgba(255,255,255,0.2);border-radius:50%;text-align:center;line-height:28px;font-size:14px;">✦</span>
                <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Namorama</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:32px;">
              <#nested>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
                Vous recevez cet email car un compte Namorama est associé à cette adresse.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="https://namorama.com" style="color:#10b981;text-decoration:none;">namorama.com</a>
                &nbsp;·&nbsp;
                <a href="mailto:contact@namorama.com" style="color:#10b981;text-decoration:none;">contact@namorama.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
</#macro>
