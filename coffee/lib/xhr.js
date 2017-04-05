// Create XMLHttpRequest
function newrequest(){
  if(navigator.appName == "Microsoft Internet Explorer"){
    return new ActiveXObject("Microsoft.XMLHTTP");
  }else{
    return new XMLHttpRequest();
  }  
}

// Get Function
function get(elements, action, contid){
  var request = newrequest();
  request.open('GET', action+'?'+elements+'&r='+new Date().getTime(), true);
  request.onreadystatechange = function(){output(request,contid)};
  request.send();
}

// Post Function
function post(elements, action, contid){
  var request = newrequest();  
  request.open('POST', action, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  request.onreadystatechange = function(){output(request, contid)}; 
  request.send(elements+'&r='+new Date().getTime());
}

// Response
function output(request, contid){
  if(request.readyState == 4){ // When Processed
    if(contid){
      document.getElementById(contid).innerHTML = request.responseText;
    }else{
      eval(request.responseText);
    }
  }
}