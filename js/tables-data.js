/* ============================================================
   Tree House — بيانات المنيو (الغرفة: كل قسم طاولة)
   ▸ price:null = السعر ما وصلنا بعد (ما ينعرض رقم وهمي).
   ▸ draft:true = الاسم مستنتج من الستوريات ويحتاج تأكيد من الزبون.
   ▸ الصور كلها من ستوريات تري هاوس نفسها (مقصوصة ومعدّل منظورها لـ «من فوق»).
   ============================================================ */
window.TH_TABLES = {
  currency: "د.ع",
  tables: [
    {
      id: "pizza",
      kind: "rect",                     // طاولة بلوط عسلي، ورقة لكل بيتزا
      title: "بيتزا إيطالية", short: "بيتزا",
      tagline: "أطيب بيتزا بالعالم والكون ومجرة درب التبانة",
      items: [
        { id: "pepperoni", name: "بيبروني", en: "Pepperoni", draft: true,
          desc: "صوص طماطم، موزاريلا، شرائح بيبروني وجرجير", price: null,
          img: "assets/menu/pizza/pepperoni.webp" },
        { id: "italiano", name: "ايطاليانو", en: "Italiano",
          desc: "شرائح دجاج مدخّن، فطر، زيتون أسود وطماطم كرزية", price: null,
          img: "assets/menu/pizza/italiano.webp" },
        { id: "veggie", name: "الخضار", en: "Vegetariana", draft: true,
          desc: "زيتون أسود، كوسا، فلفل، طماطم كرزية وريحان", price: null,
          img: "assets/menu/pizza/veggie.webp" },
        { id: "bianca", name: "بيانكا", en: "Bianca", draft: true,
          desc: "صوص أبيض كريمي، دجاج مشوي، فطر وطماطم كرزية", price: null,
          img: "assets/menu/pizza/bianca.webp" }
      ]
    },
    {
      id: "dolci",
      kind: "round",                    // طاولة مدورة جوز، دائرة ورق تحت كل صنف
      title: "حلويات", short: "حلويات",
      tagline: "حلوات بس مو أحلى منكم",
      items: [
        { id: "cookies", name: "كوكيز بالفخارة", en: "Skillet Cookies", steam: true,
          desc: "كوكيز حار بالفخارة يذوب بالشوكولاتة، ويا آيس كريم", note: "محبوبة الجماهير", price: null,
          img: "assets/menu/dolci/cookies.webp" },
        { id: "brownie", name: "براونيز", en: "Brownies",
          desc: "براونيز شوكولاتة غني بصوص الشوكولاتة", note: "أطيب براونيز بالعالم", price: null,
          img: "assets/menu/dolci/brownie.webp" }
      ]
    }
  ]
};
