import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json();

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Message length check
    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message too long. Max 2000 characters.' }, { status: 503 });
    }

    // Check for Resend API key
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json({ error: 'Email service not configured. Please try again later.' }, { status: 503 });
    }

    // Dynamic import to avoid build issues if package not installed
    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);

    const { error } = await resend.emails.send({
      from: 'SlushFund Contact <onboarding@resend.dev>',
      to: process.env.CONTACT_EMAIL ?? 'theaipowergrid@gmail.com',
      replyTo: email,
      subject: `[SlushFund] ${subject || 'No subject'} — from ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0f172a; padding: 24px; border-radius: 8px 8px 0 0;">
            <h2 style="color: #22c55e; margin: 0;">New Contact from SlushFund.net</h2>
          </div>
          <div style="background: #1e293b; padding: 24px; border-radius: 0 0 8px 8px; color: #e2e8f0;">
            <p style="margin: 0 0 16px;"><strong style="color: #94a3b8;">Name:</strong> ${escapeHtml(name)}</p>
            <p style="margin: 0 0 16px;"><strong style="color: #94a3b8;">Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color: #22c55e;">${escapeHtml(email)}</a></p>
            <p style="margin: 0 0 16px;"><strong style="color: #94a3b8;">Subject:</strong> ${escapeHtml(subject || 'No subject')}</p>
            <hr style="border: none; border-top: 1px solid #334155; margin: 16px 0;" />
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 12px;">
            Sent from slushfund.net contact form. Reply directly to this email to respond to ${escapeHtml(name)}.
          </p>
        </div>
      `,
      text: `
New contact from SlushFund.net

Name: ${name}
Email: ${email}
Subject: ${subject || 'No subject'}

Message:
${message}

---
Sent from slushfund.net contact form. Reply directly to this email to respond to ${name}.
      `.trim(),
    });

    if (error) {
      console.error('Resend error:', JSON.stringify(error));
      const msg = error?.message || error?.name || 'Unknown error';
      return NextResponse.json({ error: `Email service error: ${msg}. Please try again.` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}