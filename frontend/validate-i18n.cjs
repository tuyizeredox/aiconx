const fs = require('fs');
const locales = ['en','es','fr','de','ar','zh','pt','ja','rw','sw'];
const requiredKeys = [
  'support.backToHome','support.title','support.subtitle',
  'support.channels.aiAssistant.title','support.channels.aiAssistant.description','support.channels.aiAssistant.action',
  'support.channels.liveChat.title','support.channels.liveChat.description','support.channels.liveChat.action',
  'support.channels.reportIssue.title','support.channels.reportIssue.description','support.channels.reportIssue.action',
  'support.channels.emailSupport.title','support.channels.emailSupport.description','support.channels.emailSupport.action',
  'support.buyerProtection.badge','support.buyerProtection.title','support.buyerProtection.description',
  'support.buyerProtection.monitoring','support.buyerProtection.prioritySupport',
  'support.faq.title','support.faq.q1','support.faq.a1','support.faq.q2','support.faq.a2',
  'support.faq.q3','support.faq.a3','support.faq.q4','support.faq.a4',
  'support.report.title','support.report.description','support.report.reasonLabel',
  'support.report.reasonPlaceholder','support.report.reasons.bugReport','support.report.reasons.safetyConcern',
  'support.report.reasons.technicalIssue','support.report.reasons.vendorIssue','support.report.reasons.feedback',
  'support.report.reasons.other','support.report.detailsLabel','support.report.detailsPlaceholder',
  'support.report.submit','support.report.submitting','support.report.selectReasonError',
  'support.report.submitSuccess','support.report.submitError',
];
function get(obj, path) { return path.split('.').reduce((a,k) => a && a[k], obj); }
let allGood = true;
locales.forEach(locale => {
  const path = 'd:/projects/vetora/src/locales/' + locale + '/translation.json';
  let data;
  try { data = JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch(e) { console.log('[' + locale + '] JSON ERROR: ' + e.message); allGood = false; return; }
  const missing = requiredKeys.filter(k => !get(data, k));
  if (!missing.length) console.log('[' + locale + '] OK (' + requiredKeys.length + ' keys)');
  else { console.log('[' + locale + '] MISSING: ' + missing.join(', ')); allGood = false; }
});
console.log(allGood ? '\nAll locales valid!' : '\nIssues found!');
