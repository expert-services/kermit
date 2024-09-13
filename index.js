/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

const kermit = `                                                                                   
                                                                                   
                                                   .....@@                         
                                               ..==----.@                          
                                            .:==---:---                            
                  ==::=.                ..-==-------:-===         ==.              
       :.. .-.: =:...*.-           ==-=:-::--------------=========---=             
      :......=.........=  :#:       =---------------------------------=.           
     .    ..:--:.......   #########.  -@-----------------=--------------=          
     ...         .....-:  #*++++###====--%#*+=---------------------------=.        
              :...=########++++##.  =*=----------+*%*---------------------=.       
    .........:........-+++++++##.     ==---------------=+@@@@*@@%----------=       
     :............-###*++++++##.       ==-------==-=---------==------------=       
     ==###........##++++++++##          -=-------------------------=%@@#=--=       
         -###+=*#+-#++++++*##            :=---------------------=@@@@@=----=       
            =.....-#*++++###              .==---------------=%@@@@@--------=       
               ....+#*####-                 ==-------==#@@@@@@@*=----------=       
                 ..####:.                    .==------------------------==-*       
              .-....                           ==-----------------=-=--==--=.      
              .....=                            .==---------------==+=====-*-      
              ....-.                              =-----------------=+*====*.      
             .....=                               .=-----------------=++===%       
             :...-=                                .=------------------+%@%%       
            .....-=                                  =----=+==-----------%@+       
            .....-.                                  =-----==@@@@@#=-------=       
            :...--.                                 ..-+*=-------@@@@@@+---=       
            ...:--.                               .:.....=@@@@@@-------%@@++.      
            .:---+*=.                           ............................=.     
             .-------===..                    .-=...........................:==.   
              .-----------======:......::===.-@=.....@@-.......@:.......-.....:-=  
.............-:.---------------------------.=*-....@+--......-*--......-=@-....-@=.
...................-----------------------.--:...=#----.....-----:.....---@:....#@.
..................=**-....::------------=.-:-...==-----....=+-----....=----@:....%-
.........:::::-=#=--+%%%###########*#.#=.:.:-..%-------...=-------...:------@....--
.*#*#*######%%%%%%%#%####%%##%%#######%.:.:-.-=--------..=-------#-..----------:.--
..............::::...:::.:...:::----+%-..::------------.----------=.:-----------.--
............-::..:::.....::--::::..-@ ....:-----------=.=---------%-+=@@@@-------:-
.....................:::.-:.:::::::%:...:------------------------------=@@@=------:
########%@@@@@@@@@@@@%%@@%%%@%@@%%@-......------------------------------=@@==------
............:--:..-:.:-::---:==+##- .:.:----------------:-----------------@--------
.:::::-:=++----+==::-=-==------:*-....:.::---------------@@@%==%=--==-----=-----=--
.......................:........=.     .:---------------=@@@@--@@--@*-----=@@%-----
`;

export default (app) => {
  app.onAny(async (context) => {
    const { name, payload } = context;
    const { action, exemption_request: exemptionRequest, repository: repo } = payload;
    const owner = repo.owner.login;
    const repoName = repo.name;

    const fetchRolesWithPermission = async () => {
      const rolesResponse = await context.octokit.request('GET /orgs/{org}/organization-roles', { org: owner });
      const roles = rolesResponse.data.roles;
      return roles.filter(role => role.permissions.includes('org_review_and_manage_secret_scanning_bypass_requests'));
    };

    const fetchTeamsForRoles = async (rolesWithPermission) => {
      const teamsWithRolesPromises = rolesWithPermission.map(role =>
        context.octokit.request('GET /orgs/{org}/organization-roles/{role_id}/teams', {
          org: owner,
          role_id: role.id
        }).then(response => ({
          role: role.name,
          teams: response.data.map(team => team.slug) // Use team slug instead of name
        }))
      );
      return await Promise.all(teamsWithRolesPromises);
    };

    const updateIssueLabels = async (issue, newStatus) => {
      try {
        // Log the newStatus to ensure it has the correct value
        app.log.info(`Updating issue labels with new status: ${newStatus}`);

        const oldStatus = issue.labels.find(label => label.name.startsWith('bypass-request-'));
        if (oldStatus) {
          // Log the oldStatus to ensure it is found correctly
          app.log.info(`Removing old label: ${oldStatus.name}`);
          await context.octokit.issues.removeLabel({
            owner,
            repo: repoName,
            issue_number: issue.number,
            name: oldStatus.name
          });
        }

        // Log the label being added
        const newLabel = 'bypass-request-' + newStatus;
        app.log.info(`Adding new label: ${newLabel}`);
        await context.octokit.issues.addLabels({
          owner,
          repo: repoName,
          issue_number: issue.number,
          labels: [newLabel]
        });

        // Add a comment to the issue stating whether the request was approved or denied
        const commentBody = `The request has been ${newStatus === 'approved' ? 'approved' : 'denied'}.`;
        await context.octokit.issues.createComment({
          owner,
          repo: repoName,
          issue_number: issue.number,
          body: commentBody
        });

        app.log.info(`Labels and comment updated successfully for issue #${issue.number}`);
      } catch (error) {
        app.log.error(`Error updating labels for issue #${issue.number}:`);
        app.log.error(error);
      }
    };

    const findIssueByTitle = async (issueTitle) => {
      const issues = await context.octokit.issues.listForRepo({
        owner,
        repo: repoName
      });
      return issues.data.find(issue => issue.title === issueTitle);
    };

    const processExemptionRequest = async () => {
      const rolesWithPermission = await fetchRolesWithPermission();
      if (rolesWithPermission.length === 0) {
        app.log.info("No roles with 'org_review_and_manage_secret_scanning_bypass_requests' permission found.");
        return;
      }

      const allTeamsWithRoles = await fetchTeamsForRoles(rolesWithPermission);

      allTeamsWithRoles.forEach(({ role, teams }) => {
        teams.forEach(team => {
          app.log.info(`Team with role '${role}': ${team}`);
        });
      });

      const { number: exemptionNumber, metadata: { label: secretType }, requester_login: requester, status, requester_comment: requesterComment, created_at: createdDate, expires_at: expirationDate, html_url: requestUrl } = exemptionRequest;
      const createdDateStr = new Date(createdDate).toDateString();
      const expirationDateStr = new Date(expirationDate).toDateString();
      const issueTitle = `Push Protection Bypass Requested by @${requester} for alert #${exemptionNumber}: ${secretType}`;
      const issueBody = 
        `**Alert Number**: ${exemptionNumber}\n` +
        `**Secret Type**: ${secretType}\n` +
        `**Requester**: @${requester}\n` +
        `**Status**: ${status}\n` +
        `**Requester Comment**: ${requesterComment}\n` +
        `**Created Date**: ${createdDateStr}\n` +
        `**Expiration Date**: ${expirationDateStr}\n\n` +
        `**Teams with permission to review and manage secret scanning bypass requests**:\n` +
        allTeamsWithRoles.map(({ role, teams }) => 
          teams.map(team => `**Role**: ${role}, **Team**: @${owner}/${team}`).join('\n')
        ).join('\n') + '\n\n' +
        `[View Request](${requestUrl})`;

      await context.octokit.issues.create({
        owner,
        repo: repoName,
        title: issueTitle,
        body: issueBody,
        assignees: [requester],
        labels: ['secret-scanning', 'bypass-request-' + status]
      });
    };

    const handleExemptionRequestUpdate = async (newStatus, closeIssue = false) => {
      const { number: exemptionNumber, metadata: { label: secretType }, requester_login: requester } = exemptionRequest;
      const issueTitle = `Push Protection Bypass Requested by @${requester} for alert #${exemptionNumber}: ${secretType}`;
      const issue = await findIssueByTitle(issueTitle);

      if (issue) {
        await updateIssueLabels(issue, newStatus);

        if (closeIssue) {
          await context.octokit.issues.update({
            owner,
            repo: repoName,
            issue_number: issue.number,
            state: 'closed'
          });
        } else {
          await context.octokit.issues.update({
            owner,
            repo: repoName,
            issue_number: issue.number,
            state: 'open'
          });
        }
      } else {
        app.log.error(`Issue with title "${issueTitle}" not found.`);
      }
    };

    try {
      if (name === "exemption_request_secret_scanning" && action === "created") {
        app.log.info("exemption_request_secret_scanning.created", payload);
        await processExemptionRequest();
      } else if (name === "exemption_request_secret_scanning" && action === "completed") {
        app.log.info("exemption_request_secret_scanning.completed", payload);
        await handleExemptionRequestUpdate(exemptionRequest.status, true);
      } else if (name === "exemption_request_secret_scanning" && action === "response_dismissed") {
        app.log.info("exemption_request_secret_scanning.response_dismissed", payload);
        await handleExemptionRequestUpdate(exemptionRequest.status, false);
      } else if (name === "exemption_request_secret_scanning" && action === "response_submitted") {
        app.log.info("exemption_request_secret_scanning.response_submitted", payload);
        await handleExemptionRequestUpdate(exemptionRequest.status, false);
      }
    } catch (error) {
      app.log.error("Error processing exemption request:");
      app.log.error(error);
    }
  });

  app.log.info("Kermit's listening!");
  app.log.info(kermit);
};
