<#import "template.ftl" as layout>
<@layout.emailLayout>
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">Vérifiez votre adresse email</h2>
  <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
    Bonjour<#if user.firstName??> ${user.firstName}</#if>,<br><br>
    Merci de créer votre compte Namorama. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.
  </p>
  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
    <tr>
      <td style="border-radius:8px;background-color:#10b981;">
        <a href="${link}" target="_blank"
           style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">
          Vérifier mon email
        </a>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
    Ce lien est valide pendant <strong>${linkExpiration}</strong>.
  </p>
  <p style="margin:0;font-size:13px;color:#6b7280;">
    Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
  </p>
</@layout.emailLayout>
