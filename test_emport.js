// test_emport.js

// 1. Named Exports
export const helloUser = (name) => {
    return `Hello ${name}! Welcome to Vexora Engine.`;
};

export const appMetadata = {
    appName: "Vexora Core",
    version: "1.2.2",
    environment: "development"
};

// 2. Default Export
export const calculateDiscount = (price, discountPercent) => {
    const discountAmount = (price * discountPercent) / 100;
    return {
        originalPrice: price,
        discountPercent: `${discountPercent}%`,
        discountAmount: discountAmount,
        finalPrice: price - discountAmount
    };
};

export default {
    helloUser,
    appMetadata,
    calculateDiscount
};
