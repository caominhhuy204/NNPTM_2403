const nodemailer = require("nodemailer");

const smtpHost = process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io";
const smtpPort = Number(process.env.SMTP_PORT || 25);
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";

function ensureMailConfig() {
    if (!smtpUser || !smtpPass) {
        throw new Error("SMTP_USER hoac SMTP_PASS chua duoc cau hinh");
    }
}

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
});

module.exports = {
    sendMail: async (to,url) => {
        ensureMailConfig();
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "request resetpassword email",
            text: "click vao day de reset", // Plain-text version of the message
            html: "click vao <a href="+url+">day</a> de reset", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendUserPasswordMail: async (to, username, password) => {
        ensureMailConfig();
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "Thong tin tai khoan moi",
            text: `Tai khoan cua ban da duoc tao. Username: ${username}. Password tam thoi: ${password}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
                    <img
                        src="https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=1200&q=80"
                        alt="Welcome banner"
                        style="width:100%; border-radius: 10px; margin-bottom: 16px;"
                    />
                    <h2 style="margin: 0 0 12px 0;">Tai khoan moi da duoc tao</h2>
                    <p style="margin: 0 0 8px 0;">Chao <b>${username}</b>,</p>
                    <p style="margin: 0 0 8px 0;">He thong da tao tai khoan cho ban voi thong tin:</p>
                    <p style="margin: 0 0 6px 0;"><b>Username:</b> ${username}</p>
                    <p style="margin: 0 0 12px 0;"><b>Password tam thoi:</b> ${password}</p>
                    <p style="margin: 0;">Vui long dang nhap va doi mat khau ngay sau lan dang nhap dau tien.</p>
                </div>
            `,
        });

        console.log("Message sent:", info.messageId);
    }
}
