import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

 
 

 
export const listNumbers = query({
   
  args: {
    count: v.number(),
  },

   
  handler: async (ctx, args) => {
     
     
    const numbers = await ctx.db
      .query("numbers")
       
      .order("desc")
      .take(args.count);
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    return {
      viewer: user?.email ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    };
  },
});

 
export const addNumber = mutation({
   
  args: {
    value: v.number(),
  },

   
  handler: async (ctx, args) => {
     
     
     

    const id = await ctx.db.insert("numbers", { value: args.value });

    console.log("Added new document with id:", id);
     
     
  },
});

 
export const myAction = action({
   
  args: {
    first: v.number(),
    second: v.string(),
  },

   
  handler: async (ctx, args) => {
     
     
     
     

     
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    });
    console.log(data);

     
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});
