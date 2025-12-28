import { ContactForm } from "./ContactForm";
import { Mail, MessageSquare } from "lucide-react";

export function Contact() {
  return (
    <section className="py-24 px-6 bg-gray-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Info */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Have Questions?
              <span className="text-blue-500"> Get in Touch</span>
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              We&apos;d love to hear from you. Whether you have a question about features,
              pricing, or anything else, our team is ready to help.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Email Support</h3>
                  <p className="text-gray-400 text-sm">
                    We typically respond within 24 hours
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Feature Requests</h3>
                  <p className="text-gray-400 text-sm">
                    Share your ideas for improving EisenQ
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 md:p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
