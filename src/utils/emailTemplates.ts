export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function getWelcomeEmail(leadName: string, agentName: string): EmailTemplate {
  return {
    subject: `Welcome ${leadName}! Next steps with ${agentName}`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1E3A5F; font-size: 28px; margin: 0;">LeadCrest</h1>
          <p style="color: #D4A373; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0;">Engaged Intelligence</p>
        </div>

        <h2 style="color: #1E3A5F; font-size: 20px;">Hi ${leadName},</h2>

        <p style="color: #4A5568; line-height: 1.6; font-size: 16px;">
          Thank you for connecting with ${agentName}! I've received your information and I'm excited to help you find your perfect property.
        </p>

        <div style="background: #F5F5F0; border-left: 4px solid #D4A373; padding: 20px; margin: 30px 0; border-radius: 8px;">
          <h3 style="color: #1E3A5F; font-size: 18px; margin-top: 0;">What happens next?</h3>
          <ul style="color: #4A5568; line-height: 1.8;">
            <li>I'll review your preferences and budget</li>
            <li>I'll prepare a personalized list of properties that match your needs</li>
            <li>I'll reach out within 24 hours to schedule a viewing</li>
          </ul>
        </div>

        <p style="color: #4A5568; line-height: 1.6; font-size: 16px;">
          In the meantime, feel free to reply to this email with any questions or additional requirements.
        </p>

        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5;">
          <p style="color: #4A5568; font-size: 14px; margin: 0;">
            Best regards,<br>
            <strong style="color: #1E3A5F;">${agentName}</strong>
          </p>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #9CA3AF; font-size: 12px;">
          <p>Powered by LeadCrest · Engaged Intelligence</p>
        </div>
      </div>
    `,
    text: `Hi ${leadName},

Thank you for connecting with ${agentName}! I've received your information and I'm excited to help you find your perfect property.

What happens next?
- I'll review your preferences and budget
- I'll prepare a personalized list of properties that match your needs
- I'll reach out within 24 hours to schedule a viewing

In the meantime, feel free to reply to this email with any questions or additional requirements.

Best regards,
${agentName}

---
Powered by LeadCrest · Engaged Intelligence`
  };
}

export function getFollowUpDay3Email(leadName: string, agentName: string): EmailTemplate {
  return {
    subject: `${leadName}, I've found some properties for you`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1E3A5F; font-size: 28px; margin: 0;">LeadCrest</h1>
          <p style="color: #D4A373; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0;">Engaged Intelligence</p>
        </div>

        <h2 style="color: #1E3A5F; font-size: 20px;">Hi ${leadName},</h2>

        <p style="color: #4A5568; line-height: 1.6; font-size: 16px;">
          I've been working on finding the perfect properties that match your criteria. I'd love to show you what I've found!
        </p>

        <div style="background: linear-gradient(135deg, #D4A373 0%, #C49363 100%); padding: 30px; margin: 30px 0; border-radius: 12px; text-align: center;">
          <h3 style="color: white; font-size: 18px; margin: 0 0 15px 0;">Ready to see your matches?</h3>
          <p style="color: white; font-size: 14px; margin: 0 0 20px 0;">Let's schedule a viewing this week</p>
          <a href="mailto:${agentName.toLowerCase().replace(/\s+/g, '.')}@example.com" style="display: inline-block; background: white; color: #1E3A5F; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            Reply to Schedule
          </a>
        </div>

        <p style="color: #4A5568; line-height: 1.6; font-size: 16px;">
          I'm here to answer any questions and help you through every step of the process.
        </p>

        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5;">
          <p style="color: #4A5568; font-size: 14px; margin: 0;">
            Best regards,<br>
            <strong style="color: #1E3A5F;">${agentName}</strong>
          </p>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #9CA3AF; font-size: 12px;">
          <p>Powered by LeadCrest · Engaged Intelligence</p>
        </div>
      </div>
    `,
    text: `Hi ${leadName},

I've been working on finding the perfect properties that match your criteria. I'd love to show you what I've found!

Let's schedule a viewing this week. Reply to this email to set up a time that works for you.

I'm here to answer any questions and help you through every step of the process.

Best regards,
${agentName}

---
Powered by LeadCrest · Engaged Intelligence`
  };
}

export function getFollowUpDay7Email(leadName: string, agentName: string): EmailTemplate {
  return {
    subject: `${leadName}, don't miss out on these opportunities`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1E3A5F; font-size: 28px; margin: 0;">LeadCrest</h1>
          <p style="color: #D4A373; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0;">Engaged Intelligence</p>
        </div>

        <h2 style="color: #1E3A5F; font-size: 20px;">Hi ${leadName},</h2>

        <p style="color: #4A5568; line-height: 1.6; font-size: 16px;">
          I haven't heard back from you and I want to make sure you're still interested. The market moves fast, and I'd hate for you to miss out on properties that perfectly match what you're looking for.
        </p>

        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 30px 0; border-radius: 8px;">
          <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.6;">
            <strong>Market Update:</strong> Properties in your preferred area are getting multiple offers within days. Let's connect before the best ones are gone!
          </p>
        </div>

        <p style="color: #4A5568; line-height: 1.6; font-size: 16px;">
          If your situation has changed or you'd like to adjust your search criteria, just let me know. I'm here to help on your timeline.
        </p>

        <div style="background: #F5F5F0; padding: 25px; margin: 30px 0; border-radius: 12px; text-align: center;">
          <p style="color: #1E3A5F; font-size: 16px; margin: 0 0 20px 0; font-weight: 600;">Ready to move forward?</p>
          <a href="mailto:${agentName.toLowerCase().replace(/\s+/g, '.')}@example.com" style="display: inline-block; background: #1E3A5F; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            Let's Talk
          </a>
        </div>

        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5;">
          <p style="color: #4A5568; font-size: 14px; margin: 0;">
            Looking forward to hearing from you,<br>
            <strong style="color: #1E3A5F;">${agentName}</strong>
          </p>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #9CA3AF; font-size: 12px;">
          <p>Powered by LeadCrest · Engaged Intelligence</p>
        </div>
      </div>
    `,
    text: `Hi ${leadName},

I haven't heard back from you and I want to make sure you're still interested. The market moves fast, and I'd hate for you to miss out on properties that perfectly match what you're looking for.

Market Update: Properties in your preferred area are getting multiple offers within days. Let's connect before the best ones are gone!

If your situation has changed or you'd like to adjust your search criteria, just let me know. I'm here to help on your timeline.

Looking forward to hearing from you,
${agentName}

---
Powered by LeadCrest · Engaged Intelligence`
  };
}

export function getDocumentSignedEmail(leadName: string, agentName: string, documentType: string): EmailTemplate {
  return {
    subject: `Document signed: ${documentType}`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1E3A5F; font-size: 28px; margin: 0;">LeadCrest</h1>
          <p style="color: #D4A373; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0;">Engaged Intelligence</p>
        </div>

        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: #A4B494; border-radius: 50%; padding: 20px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <h2 style="color: #1E3A5F; font-size: 22px; text-align: center; margin-bottom: 20px;">Document Successfully Signed!</h2>

        <p style="color: #4A5568; line-height: 1.6; font-size: 16px; text-align: center;">
          Hi ${leadName}, your <strong>${documentType}</strong> has been signed and processed.
        </p>

        <div style="background: #F5F5F0; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <h3 style="color: #1E3A5F; font-size: 16px; margin-top: 0;">Next Steps:</h3>
          <ol style="color: #4A5568; line-height: 1.8; padding-left: 20px;">
            <li>Your agent will review the signed document</li>
            <li>You'll receive a confirmation email with next steps</li>
            <li>${agentName} will reach out to schedule the next phase</li>
          </ol>
        </div>

        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5;">
          <p style="color: #4A5568; font-size: 14px; margin: 0;">
            Thank you for your prompt action,<br>
            <strong style="color: #1E3A5F;">${agentName}</strong>
          </p>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #9CA3AF; font-size: 12px;">
          <p>Powered by LeadCrest · Engaged Intelligence</p>
        </div>
      </div>
    `,
    text: `Document Successfully Signed!

Hi ${leadName}, your ${documentType} has been signed and processed.

Next Steps:
1. Your agent will review the signed document
2. You'll receive a confirmation email with next steps
3. ${agentName} will reach out to schedule the next phase

Thank you for your prompt action,
${agentName}

---
Powered by LeadCrest · Engaged Intelligence`
  };
}
