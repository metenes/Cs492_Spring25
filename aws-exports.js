import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'eu-north-1',
    userPoolId: 'us-east-1:7d943cd7-bf11-40c1-a1ad-8700ea2b2c6e',
    userPoolWebClientId: 'your-app-client-id',
    oauth: {
      domain: 'your-cognito-domain',
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: 'yourapp://callback/',
      redirectSignOut: 'yourapp://signout/',
      responseType: 'code'
    }
  }
});
