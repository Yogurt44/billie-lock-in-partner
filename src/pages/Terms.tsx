const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 13, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By downloading, accessing, or using BILLIE ("the App" or "Service"), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use our Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
          <p className="text-muted-foreground">
            BILLIE is an AI-powered accountability partner app. Users set personal goals, receive daily check-in 
            reminders via push notifications, and engage in motivational conversations to stay on track with their objectives.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Account and Registration</h2>
          <p className="text-muted-foreground mb-4">
            To use BILLIE, you may be asked to provide your email address for account verification. You are responsible for:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Providing accurate information</li>
            <li>Maintaining the security of your account</li>
            <li>All activities that occur under your account</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Subscription and Payments</h2>
          <p className="text-muted-foreground mb-4">
            BILLIE offers a free onboarding experience. After onboarding, continued access requires a paid subscription:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>Monthly:</strong> $9.99/month, billed monthly until cancelled</li>
            <li><strong>Annual:</strong> $79.99/year, billed annually until cancelled</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            <strong>What's included:</strong> Unlimited daily check-ins, personalized AI accountability conversations, 
            streak tracking, goal management, and push notification reminders.
          </p>
          <p className="text-muted-foreground mt-4">
            <strong>Cancellation:</strong> You can cancel your subscription at any time through Stripe's customer portal 
            (link available in app Settings). Cancellation takes effect at the end of your current billing period. 
            No refunds are provided for partial billing periods.
          </p>
          <p className="text-muted-foreground mt-4">
            <strong>Auto-Renewal:</strong> Subscriptions automatically renew unless cancelled at least 24 hours before 
            the end of the current period.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Push Notifications</h2>
          <p className="text-muted-foreground">
            BILLIE may request permission to send push notifications for daily check-in reminders and accountability messages. 
            Push notifications are optional and can be disabled at any time in your device settings. 
            The app functions without push notifications enabled.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. User Conduct</h2>
          <p className="text-muted-foreground">
            You agree not to use the Service for any unlawful purpose or to send abusive, harassing, or 
            inappropriate messages. We reserve the right to terminate access for violations of these terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Disclaimer</h2>
          <p className="text-muted-foreground">
            BILLIE is not a substitute for professional mental health services, therapy, or medical advice. 
            The AI-generated responses are for motivational and accountability purposes only. 
            The Service is provided "as is" without warranties of any kind. If you are experiencing a mental health crisis, 
            please contact a qualified healthcare professional or emergency services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Account Deletion</h2>
          <p className="text-muted-foreground">
            You may delete your account at any time through the Settings page in the app. Upon deletion, 
            all your personal data, conversation history, and goals will be permanently erased within 30 days. 
            Any active subscription will be cancelled.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We may modify these Terms at any time. Continued use of the Service after changes constitutes 
            acceptance of the modified Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Contact</h2>
          <p className="text-muted-foreground">
            Questions about these terms? Contact us at:<br />
            <strong>Email:</strong> contact@trybillie.app<br />
            <strong>Developer:</strong> HADEA LLC
          </p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
