/**
 * Convert numbers to Indian Currency Words (Lakhs, Crores, Thousands)
 * Example: 122977 -> "One Lakh Twenty Two Thousand Nine Hundred Seventy Seven Only"
 */
export function numberToIndianWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertHundreds(val) {
    let str = '';
    if (val >= 100) {
      str += ones[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += ones[val] + ' ';
    }
    return str.trim();
  }

  let words = '';
  let crore = Math.floor(n / 10000000);
  let remCrore = n % 10000000;
  let lakh = Math.floor(remCrore / 100000);
  let remLakh = remCrore % 100000;
  let thousand = Math.floor(remLakh / 1000);
  let remThousand = remLakh % 1000;

  if (crore > 0) {
    words += convertHundreds(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertHundreds(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertHundreds(thousand) + ' Thousand ';
  }
  if (remThousand > 0) {
    words += convertHundreds(remThousand);
  }

  const result = words.trim();
  return result ? `(${result} Only)` : '(Zero Only)';
}
