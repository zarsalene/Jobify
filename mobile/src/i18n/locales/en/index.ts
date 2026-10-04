import approvals from './approvals';
import assistant from './assistant';
import auth from './auth';
import common from './common';
import consent from './consent';
import cv from './cv';
import extras from './extras';
import home from './home';
import jobs from './jobs';
import notifications from './notifications';
import onboarding from './onboarding';
import prepare from './prepare';
import profile from './profile';
import settings from './settings';
import setup from './setup';
import states from './states';
import tabs from './tabs';
import tracker from './tracker';

/** English dictionary. One module per feature; fr/ar mirror the same shape (partial). */
const en = {
  common,
  tabs,
  onboarding,
  auth,
  consent,
  setup,
  cv,
  home,
  jobs,
  prepare,
  profile,
  tracker,
  states,
  approvals,
  assistant,
  notifications,
  settings,
  extras,
};

export default en;
