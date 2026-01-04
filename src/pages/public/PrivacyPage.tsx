import { motion } from 'framer-motion';

export function PrivacyPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 lg:py-20 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-vault-foreground mb-4"
            >
              Privacy Policy
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-vault-foreground/70"
            >
              Last updated: January 2025
            </motion.p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
            <p className="text-lg text-muted-foreground mb-8">
              This Privacy Policy explains how we collect, use, and protect your information when you use our website and services. By creating an account or using the service, you agree to the practices described below.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">1. Information we collect</h2>
            <p className="text-muted-foreground mb-4">We collect the following types of information:</p>
            
            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Information you provide directly</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Name or display name</li>
              <li>Email address</li>
              <li>Password</li>
              <li>Trusted contact information</li>
              <li>Your preferences for check-ins and notifications</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Content you upload</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Documents, images, videos, and other files you choose to store with us</li>
              <li>Messages or notes attached to files or contacts</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Usage and technical information</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>IP address</li>
              <li>Device and browser type</li>
              <li>Log and activity data (pages visited, actions taken)</li>
              <li>Cookies or similar technologies used to keep you signed in and maintain session security</li>
            </ul>
            <p className="text-muted-foreground mt-4">We do not collect more information than is necessary to provide the service.</p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">2. How we use your information</h2>
            <p className="text-muted-foreground mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Create and maintain your account</li>
              <li>Securely store the files you upload</li>
              <li>Send reminders for your scheduled check-ins</li>
              <li>Deliver your selected files to your trusted contacts when your configured conditions are met</li>
              <li>Communicate with you about your account or security alerts</li>
              <li>Monitor service performance and improve features</li>
              <li>Prevent fraud or abuse of the platform</li>
            </ul>
            <p className="text-muted-foreground mt-4 font-medium">We do not use your content for advertising or data resale.</p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">3. How your data is protected</h2>
            <p className="text-muted-foreground mb-4">We take data security seriously.</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Your data is encrypted during transfer</li>
              <li>Your data is encrypted while stored</li>
              <li>We use modern encryption standards such as AES-256 for stored data and TLS for data in transit</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Access to systems containing sensitive information is limited to authorized personnel who require it to operate the service, and access is logged.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">4. Who we share information with</h2>
            <p className="text-muted-foreground mb-4 font-medium">We do not sell or rent your data.</p>
            <p className="text-muted-foreground mb-4">We may share limited information with carefully selected service providers who help us:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Host and operate the platform</li>
              <li>Send emails and notifications</li>
              <li>Process payments</li>
            </ul>
            <p className="text-muted-foreground mt-4">These providers are only permitted to use your information to perform services on our behalf.</p>
            <p className="text-muted-foreground mt-4">
              Your files are only shared with trusted contacts you selected, and only when the conditions you configured are triggered.
            </p>
            <p className="text-muted-foreground mt-4">
              We may also disclose information when required to comply with law, legal process, or to protect the rights and safety of our users or the service.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">5. Cookies and tracking technologies</h2>
            <p className="text-muted-foreground mb-4">We may use cookies or similar technologies to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Keep you signed in</li>
              <li>Remember your preferences</li>
              <li>Improve website functionality</li>
              <li>Understand anonymous usage trends</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You can disable cookies through your browser settings, but some features may not work properly without them.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">6. Children's privacy</h2>
            <p className="text-muted-foreground">
              This service is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will delete it.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">7. Your choices and rights</h2>
            <p className="text-muted-foreground mb-4">You may:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Update your account information</li>
              <li>Change or delete trusted contacts</li>
              <li>Delete your uploaded files</li>
              <li>Delete your entire account</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              When you delete information, it is removed from our active systems within a reasonable time period.
            </p>
            <p className="text-muted-foreground mt-4">
              If you have questions or requests about your data, contact us at <a href="mailto:support@example.com" className="text-primary hover:underline">support@example.com</a>.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">8. Changes to this Privacy Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or through the service. Continued use of the service after changes means you accept the revised policy.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
