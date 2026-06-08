import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">
          {ar ? "سياسة الخصوصية" : "Privacy Policy"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {ar ? "آخر تحديث: 8 يونيو 2026" : "Last updated: June 8, 2026"}
        </p>

        {ar ? (
          <div className="prose prose-sm max-w-none space-y-6 text-foreground">
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">من نحن</h2>
              <p>
                العين لتجارة الحاسبات («نحن»، «المتجر») تدير موقع{" "}
                <a href="https://aeen-iq.com" className="text-primary underline" dir="ltr">
                  aeen-iq.com
                </a>{" "}
                وتطبيقاتنا المرتبطة بخدمات واتساب وفيسبوك لإدارة الطلبات والصيانة والتواصل مع العملاء.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">البيانات التي نجمعها</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>الاسم ورقم الهاتف والبريد الإلكتروني عند الطلب أو طلب الصيانة</li>
                <li>تفاصيل الطلبات، الفواتير، ومعلومات الأجهزة المرسلة للصيانة</li>
                <li>رسائل واتساب المرسلة أو المستلمة عبر أنظمتنا (بموافقتك)</li>
                <li>بيانات تقنية أساسية مثل عنوان IP ونوع المتصفح لتحسين الموقع</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">كيف نستخدم بياناتك</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>معالجة الطلبات والمبيعات وطلبات الصيانة</li>
                <li>إرسال تحديثات حالة الطلب أو الصيانة عبر واتساب أو الرسائل</li>
                <li>الرد على استفسارات العملاء وتحسين خدماتنا</li>
                <li>النشر على صفحة فيسبوك التجارية الخاصة بالمتجر (محتوى تسويقي عام)</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">مشاركة البيانات</h2>
              <p>
                لا نبيع بياناتك الشخصية. قد نشارك البيانات الضرورية فقط مع مزودي الخدمة الموثوقين
                (مثل Meta/WhatsApp لإرسال الرسائل، وبوابات الدفع) لتقديم الخدمة. يخضع هؤلاء
                المزودون لسياسات الخصوصية الخاصة بهم.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">الاحتفاظ بالبيانات والأمان</h2>
              <p>
                نحتفظ بالبيانات طالما كانت ضرورية لتقديم الخدمة والالتزامات القانونية. نطبق
                إجراءات أمنية معقولة لحماية معلوماتك من الوصول غير المصرح به.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">حقوقك</h2>
              <p>
                يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها بالتواصل معنا عبر واتساب أو
                الهاتف الموجودين على موقعنا.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">تواصل معنا</h2>
              <p>
                العين لتجارة الحاسبات — كربلاء، العراق
                <br />
                الموقع:{" "}
                <a href="https://aeen-iq.com" className="text-primary underline" dir="ltr">
                  https://aeen-iq.com
                </a>
              </p>
            </section>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none space-y-6 text-foreground">
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Who we are</h2>
              <p>
                Al-Ain Computer Store (&quot;we&quot;, &quot;our store&quot;) operates{" "}
                <a href="https://aeen-iq.com" className="text-primary underline">
                  aeen-iq.com
                </a>{" "}
                and related integrations with WhatsApp and Facebook to manage orders, repairs, and
                customer communications.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Information we collect</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Name, phone number, and email when you place orders or request repairs</li>
                <li>Order, invoice, and device details for repair services</li>
                <li>WhatsApp messages sent or received through our systems (with your consent)</li>
                <li>Basic technical data such as IP address and browser type</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">How we use information</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Process sales, orders, and repair requests</li>
                <li>Send order and repair status updates via WhatsApp or messaging</li>
                <li>Respond to customer inquiries and improve our services</li>
                <li>Publish marketing content on our official Facebook Page</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Sharing</h2>
              <p>
                We do not sell your personal data. We may share necessary information only with
                trusted service providers (such as Meta/WhatsApp for messaging and payment gateways)
                to deliver our services.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Retention and security</h2>
              <p>
                We retain data as long as needed to provide services and meet legal obligations. We
                apply reasonable security measures to protect your information.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Your rights</h2>
              <p>
                You may request access, correction, or deletion of your data by contacting us via the
                phone or WhatsApp listed on our website.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Contact</h2>
              <p>
                Al-Ain Computer Store — Baghdad, Iraq
                <br />
                Website:{" "}
                <a href="https://aeen-iq.com" className="text-primary underline">
                  https://aeen-iq.com
                </a>
              </p>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
