/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
const NodeCache = require('node-cache');

@Injectable()
export class OTPService {
  private cacheClient: any;

  constructor() {
    this.cacheClient = new NodeCache({ stdTTL: 300 });
  }

  async storeMobileNumberOTP(reference: any, stdTTL: any) {
    try {
      const response = this.cacheClient.set('mobileNumber', reference, stdTTL);
      console.log('reponse is 10', response);
      return response;
    } catch (err) {
      throw new Error(`Error storing mobile number OTP: ${err}`);
    }
  }

  getMobileNumberOTPReference() {
    try {
      const reference = this.cacheClient.get('mobileNumber');
      return reference;
    } catch (err) {
      throw new Error(`Error getting mobile number OTP reference: ${err}`);
    }
  }

  async storeEmailIdOTP(reference: any, stdTTL: any) {
    try {
      const response = this.cacheClient.set('emailId', reference, stdTTL);
      console.log('reponse is 29', response);
      return response;
    } catch (err) {
      throw new Error(`Error storing email ID OTP: ${err}`);
    }
  }

  async getOTPEmailIdReference() {
    try {
      const reference = this.cacheClient.get('emailId');
      return reference;
    } catch (err) {
      throw new Error(`Error getting email ID OTP reference: ${err}`);
    }
  }

  async storeForgetPassWordAcessToken(reference: any) {
    try {
      const response = this.cacheClient.set(
        'forgetPassword_acessToken',
        reference,
        240,
      );
      console.log('reponse is 29', response);
      return response;
    } catch (err) {
      throw new Error(`Error storing forgetPassword Acess: ${err}`);
    }
  }

  async getForgetPassWordAcessTokenReference() {
    try {
      const reference = this.cacheClient.get('forgetPassword_acessToken');
      return reference;
    } catch (err) {
      throw new Error(
        `Error getting forgetPassword_acessToken reference: ${err}`,
      );
    }
  }
}
