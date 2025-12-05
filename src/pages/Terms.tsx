const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 5, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using BILLIE ("the Service"), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use our Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
          <p className="text-muted-foreground">
            BILLIE is an SMS-based accountability partner service. Users text our number to set personal goals, 
            receive daily check-in reminders, and get motivational support via text message.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. SMS Messaging Terms</h2>
          <p className="text-muted-foreground mb-4">
            By texting BILLIE, you consent to receive recurring automated text messages related to your 
            accountability goals and check-ins. Message frequency varies based on your preferences and engagement.
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Message and data rates may apply</li>
            <li>You can opt-out at any time by replying STOP</li>
            <li>For help, reply HELP or contact contact@trybillie.app</li>
            <li>Carriers are not liable for delayed or undelivered messages</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Subscription and Payments</h2>
          <p className="text-muted-foreground">
            BILLIE offers a free onboarding experience. After onboarding, continued access requires a paid 
            subscription at $9.99/month or $79.99/year. Subscriptions are managed through Stripe and can be 
            cancelled at any time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. User Conduct</h2>
          <p className="text-muted-foreground">
            You agree not to use the Service for any unlawful purpose or to send abusive, harassing, or 
            inappropriate messages. We reserve the right to terminate access for violations.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Disclaimer</h2>
          <p className="text-muted-foreground">
            BILLIE is not a substitute for professional mental health services, therapy, or medical advice. 
            The Service is provided "as is" without warranties of any kind.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Contact</h2>
          <p className="text-muted-foreground">
            Questions about these terms? Contact us at contact@trybillie.app
          </p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
