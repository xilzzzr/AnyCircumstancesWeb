import { motion } from 'framer-motion';

export function TermsPage() {
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
              Terms and Conditions
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
              These Terms and Conditions ("Terms") govern your use of the website and services provided by us. By creating an account or using the service, you agree to these Terms.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">1. Description of the service</h2>
            <p className="text-muted-foreground mb-4">Our service allows you to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Upload and store digital files</li>
              <li>Designate trusted contacts</li>
              <li>Set check-in reminders at chosen intervals</li>
              <li>Automatically deliver selected files to your trusted contacts if you stop checking in according to the settings you chose</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You remain in control of your account, files, and contacts at all times until an automated release is triggered according to your configuration.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">2. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be legally able to enter into binding agreements to use this service. If you use the service on behalf of an organization, you confirm that you are authorized to do so.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">3. Your responsibilities</h2>
            <p className="text-muted-foreground mb-4">You agree that you are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>Ensuring your contact information and trusted contact details are accurate</li>
              <li>Selecting appropriate check-in intervals and notification preferences</li>
              <li>Complying with applicable laws for content you upload</li>
            </ul>
            <p className="text-muted-foreground mt-6 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Upload illegal content</li>
              <li>Infringe the intellectual property rights of others</li>
              <li>Attempt to interfere with or disrupt the service</li>
              <li>Use the service for fraud or abuse</li>
            </ul>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">4. Content ownership</h2>
            <p className="text-muted-foreground mb-4">You retain ownership of the files and content you upload.</p>
            <p className="text-muted-foreground mb-4">
              By uploading content, you grant us a limited, non-exclusive license solely to store, encrypt, process, and deliver your files as part of the service features you configure.
            </p>
            <p className="text-muted-foreground font-medium">We do not claim ownership of your files.</p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">5. Automated file release</h2>
            <p className="text-muted-foreground mb-4">You understand and agree that:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Failure to check in within your configured timeframes may trigger delivery of your selected files to your trusted contacts</li>
              <li>It is your responsibility to keep your settings and contacts accurate</li>
              <li>We are not responsible for actions taken by your trusted contacts after receiving your files</li>
            </ul>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">6. Service availability</h2>
            <p className="text-muted-foreground mb-4">
              We strive to provide reliable service but do not guarantee uninterrupted or error-free operation. Occasional downtime may occur due to maintenance, technical issues, or factors beyond our control.
            </p>
            <p className="text-muted-foreground mb-4">We are not liable for delays or failures caused by:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Internet or network disruptions</li>
              <li>Email delivery failures</li>
              <li>Incorrect contact information provided by you</li>
            </ul>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">7. Termination</h2>
            <p className="text-muted-foreground mb-4">You may close your account at any time through your settings.</p>
            <p className="text-muted-foreground mb-4">We may suspend or terminate accounts that:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Violate these Terms</li>
              <li>Are used for illegal purposes</li>
              <li>Pose security or operational risks</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Upon termination, your access will end and your data may be deleted according to our privacy policy.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">8. Payments and refunds</h2>
            <p className="text-muted-foreground mb-4">
              If your plan involves paid subscriptions or storage fees, you agree to the posted pricing and billing terms.
            </p>
            <p className="text-muted-foreground">
              Unless otherwise stated, fees are non-refundable except where required by law.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">9. Limitation of liability</h2>
            <p className="text-muted-foreground mb-4">
              To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages arising out of or related to use of the service.
            </p>
            <p className="text-muted-foreground">
              Our total liability for any claim will not exceed the amount you paid to us in the 12 months preceding the claim.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">10. Indemnification</h2>
            <p className="text-muted-foreground mb-4">You agree to indemnify and hold us harmless from claims arising out of:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Content you upload</li>
              <li>Misuse of the service</li>
              <li>Violation of these Terms</li>
            </ul>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">11. Changes to these Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms occasionally. If we make material changes, we will notify you by email or within the service. Continued use after changes means you accept the updated Terms.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">12. Governing law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by applicable law, without regard to conflict-of-law principles.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">13. Contact us</h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms or the service, contact us at <a href="mailto:support@example.com" className="text-primary hover:underline">support@example.com</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
