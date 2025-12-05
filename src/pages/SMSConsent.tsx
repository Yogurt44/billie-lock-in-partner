const SMSConsent = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">SMS Consent & Opt-In</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 5, 2025</p>

        <section className="mb-8 p-6 bg-muted/30 rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">How to Opt-In</h2>
          <p className="text-muted-foreground">
            By texting BILLIE at <strong>(844) 489-0104</strong>, you are opting in to receive SMS messages 
            from BILLIE. Your first text message to us constitutes your consent to receive automated 
            text messages from our service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">What Messages You Will Receive</h2>
          <p className="text-muted-foreground mb-4">After opting in, you will receive:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Onboarding messages to set up your profile and goals</li>
            <li>Daily check-in reminders</li>
            <li>Accountability responses and motivational messages</li>
            <li>Subscription and payment confirmations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Message Frequency</h2>
          <p className="text-muted-foreground">
            Message frequency varies based on your engagement. Typically, you will receive 1-5 messages 
            per day during active conversations, plus daily check-in reminders.
          </p>
        </section>

        <section className="mb-8 p-6 bg-muted/30 rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">How to Opt-Out</h2>
          <p className="text-muted-foreground mb-4">
            You can opt-out at any time by replying <strong>STOP</strong> to any message. 
            You will receive a confirmation message and no further messages will be sent.
          </p>
          <p className="text-muted-foreground">
            To rejoin, simply text us again at (844) 489-0104.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Help</h2>
          <p className="text-muted-foreground">
            For help, reply <strong>HELP</strong> to any message or contact us at contact@trybillie.app
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Costs</h2>
          <p className="text-muted-foreground">
            Message and data rates may apply. Check with your carrier for details about your text messaging plan.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Carrier Disclaimer</h2>
          <p className="text-muted-foreground">
            Carriers are not liable for delayed or undelivered messages.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
          <p className="text-muted-foreground">
            Email: contact@trybillie.app<br />
            Website: https://trybillie.app
          </p>
        </section>
      </div>
    </div>
  );
};

export default SMSConsent;
