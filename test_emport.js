// test_emport.js

// 1. Hello User Function
export const helloUser = (name = "Guest") => {
    return `Hello ${name}! Welcome to Vexora Engine.`;
};

// 2. Calculate Discount Function
export const calculateDiscount = (price, discountPercent) => {
    const discountAmount = (price * discountPercent) / 100;
    return {
        originalPrice: price,
        discountPercent: `${discountPercent}%`,
        discountAmount: discountAmount,
        finalPrice: price - discountAmount
    };
};

// 3. App Metadata
export const appMetadata = {
    appName: "Vexora Core",
    version: "1.2.2",
    environment: "development"
};
