const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 5, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
          <p className="text-muted-foreground mb-4">When you use BILLIE, we collect:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>Phone number:</strong> To send and receive text messages</li>
            <li><strong>Name:</strong> To personalize your experience</li>
            <li><strong>Goals and messages:</strong> To provide accountability support</li>
            <li><strong>Payment information:</strong> Processed securely through Stripe</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>To provide the accountability texting service</li>
            <li>To send daily check-in reminders and motivational messages</li>
            <li>To process subscription payments</li>
            <li>To improve and personalize your experience</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. SMS Data</h2>
          <p className="text-muted-foreground">
            We store your conversation history to provide personalized accountability support and remember 
            your goals. Your message data is encrypted and stored securely. We do not sell or share your 
            SMS data with third parties for marketing purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Data Sharing</h2>
          <p className="text-muted-foreground mb-4">We only share your data with:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>Twilio:</strong> Our SMS service provider for message delivery</li>
            <li><strong>Stripe:</strong> Our payment processor for subscriptions</li>
            <li><strong>AI providers:</strong> To generate personalized responses (no PII shared)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
          <p className="text-muted-foreground">
            We retain your data for as long as your account is active. You can request deletion of your 
            data at any time by contacting contact@trybillie.app.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
          <p className="text-muted-foreground">You have the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of SMS messages by replying STOP</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Contact</h2>
          <p className="text-muted-foreground">
            Privacy questions? Contact us at contact@trybillie.app
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
