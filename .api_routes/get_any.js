 const users = await Vexora.fetchAll("auth", "SELECT * FROM projects ");
 
 Vexora.Response.success(users, "Profile loaded!");
 