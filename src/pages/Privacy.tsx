import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with back button */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/30 sticky top-0 z-10 safe-area-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-lg">Privacy Policy</h1>
        </div>
      </header>
      
      <div className="py-8 px-4 max-w-3xl mx-auto">
        <p className="text-muted-foreground mb-8">Last updated: December 13, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
          <p className="text-muted-foreground mb-4">When you use BILLIE, we collect:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>Email address:</strong> To identify your account and enable login across devices</li>
            <li><strong>Name:</strong> To personalize your experience</li>
            <li><strong>Goals and messages:</strong> To provide accountability support</li>
            <li><strong>Device identifier:</strong> To link your device to your account</li>
            <li><strong>Push notification token:</strong> To send you check-in reminders</li>
            <li><strong>Timezone:</strong> To send notifications at appropriate times</li>
            <li><strong>Payment information:</strong> Processed securely through Stripe (we do not store card details)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>To provide the accountability partner service</li>
            <li>To send daily check-in reminders via push notifications</li>
            <li>To process subscription payments</li>
            <li>To improve and personalize your experience</li>
            <li>To remember your goals and track your progress</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Conversation Data</h2>
          <p className="text-muted-foreground">
            We store your conversation history to provide personalized accountability support and remember 
            your goals over time. Your message data is encrypted in transit and stored securely. We do not sell or share your 
            conversation data with third parties for marketing purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Data Sharing</h2>
          <p className="text-muted-foreground mb-4">We only share your data with:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>Stripe:</strong> Our payment processor for subscription management</li>
            <li><strong>OpenAI:</strong> To generate personalized AI responses (no personally identifiable information shared)</li>
            <li><strong>Resend:</strong> Our email service provider for verification emails</li>
            <li><strong>Apple Push Notification Service:</strong> To deliver push notifications to your device</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            We do not sell your personal information. We do not share your data with advertisers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Data Retention and Deletion</h2>
          <p className="text-muted-foreground mb-4">
            We retain your data for as long as your account is active. When you delete your account:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>All your personal data is permanently deleted within 30 days</li>
            <li>Your conversation history is permanently erased</li>
            <li>Your goals and streak data are deleted</li>
            <li>Your subscription will be cancelled (no further charges)</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            <strong>To delete your account:</strong> Go to Settings in the app and tap "Delete Account", or email contact@trybillie.app with your deletion request.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
          <p className="text-muted-foreground mb-2">You have the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data and account</li>
            <li>Disable push notifications in your device settings</li>
            <li>Export your data upon request</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Children's Privacy</h2>
          <p className="text-muted-foreground">
            BILLIE is not intended for users under 13 years of age. We do not knowingly collect personal 
            information from children under 13. If you believe we have collected data from a child under 13, 
            please contact us immediately at contact@trybillie.app.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify you of any material changes 
            by posting the new policy in the app and updating the "Last updated" date.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
          <p className="text-muted-foreground">
            Privacy questions or data requests? Contact us at:<br />
            <strong>Email:</strong> contact@trybillie.app
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
