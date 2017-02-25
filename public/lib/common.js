var blogComments2Common = function (commentPositionDiv, nbb, kwargs) {
    "use strict";

    var articlePath = nbb.articlePath || (window.location.protocol + '//' + window.location.host + window.location.pathname);

    var savedText, nodebbDiv, contentDiv, commentsDiv, commentsCounter, commentsAuthor, commentsCategory;

    commentPositionDiv.insertAdjacentHTML('beforebegin', '<div id="nodebb"></div>');
    nodebbDiv = document.getElementById('nodebb');

    function newXHR() {
        try {
            return new XMLHttpRequest();
        } catch (e) {
            try {
                return new ActiveXObject("Microsoft.XMLHTTP");
            } catch (e) {
                return new ActiveXObject("Msxml2.XMLHTTP");
            }
        }
    }

    function xget (xhr, path) {
        xhr.open('GET', path, true);
        xhr.withCredentials = true;
        xhr.send();
        return xhr;
    }

    function xpost (xhr, path, data) {
        //构造表单数据
        var encodedString = '';
        for (var prop in data) {
            if (data.hasOwnProperty(prop)) {
                if (encodedString.length > 0) {
                    encodedString += '&';
                }
                encodedString += encodeURI(prop + '=' + data[prop]);
            }
        }
        xhr.open('POST', path, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.withCredentials = true;
        //发送数据
        xhr.send(encodedString);
        return xhr;
    }

    var XHR = newXHR(), pagination = 0, modal;
    var voteXHR = newXHR();
    var bookmarkXHR = newXHR();
    var mainPost;

    function authenticate(type) {
        savedText = contentDiv.value;
        modal = window.open(nbb.url + "/" + type + "/#blog/authenticate","_blank","toolbar=no, scrollbars=no, resizable=no, width=600, height=675");
        var timer = setInterval(function() {
            if(modal.closed) {
                clearInterval(timer);
                pagination = 0;
                reloadComments();
            }
        }, 500);
    }

    function normalizePost(post) {
        return post.replace(/href="\/(?=\w)/g, 'href="' + nbb.url + '/')
                .replace(/src="\/(?=\w)/g, 'src="' + nbb.url + '/');
    }

    function timeAgo(time){
        var time_formats = [
            [60, 'seconds', 1],
            [120, '1 minute ago'],
            [3600, 'minutes', 60],
            [7200, '1 hour ago'],
            [86400, 'hours', 3600],
            [172800, 'yesterday'],
            [604800, 'days', 86400],
            [1209600, 'last week'],
            [2419200, 'weeks', 604800],
            [4838400, 'last month'],
            [29030400, 'months', 2419200],
            [58060800, 'last year'],
            [2903040000, 'years', 29030400]
        ];

        var seconds = (+new Date() - time) / 1000;

        if (seconds < 10) {
            return 'just now';
        }

        var i = 0, format;
        while (format = time_formats[i++]) {
            if (seconds < format[0]) {
                if (!format[2]) {
                    return format[1];
                } else {
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ago';
                }
            }
        }
        return time;
    }

    XHR.onload = function() {
        if (XHR.status >= 200 && XHR.status < 400) {
            var data = JSON.parse(XHR.responseText), html;

            commentsDiv = document.getElementById('nodebb-comments-list');
            commentsCounter = document.getElementById('nodebb-comments-count');
            commentsAuthor = document.getElementById('nodebb-comments-author');
            commentsCategory = document.getElementById('nodebb-comments-category');

            data.relative_path = nbb.url;
            data.redirect_url = articlePath;
            data.article_id = nbb.articleID;
            data.pagination = pagination;
            data.postCount = parseInt(data.postCount, 10);
            for (var post in data.posts) {
                if (data.posts.hasOwnProperty(post)) {
                    data.posts[post].timestamp = timeAgo(parseInt(data.posts[post].timestamp), 10);
                    if (data.posts[post]['blog-comments:url']) {
                        delete data.posts[post];
                    }
                }
            }

            if (commentsCounter) {
                commentsCounter.innerHTML = data.postCount ? (data.postCount - 1) : 0;
            }

            if (commentsCategory && data.category) {
                commentsCategory.innerHTML = '<a href="' + nbb.url + '/category/' + data.category.slug + '">' + data.category.name + '</a>';
            }

            if (commentsAuthor && data.mainPost) {
                commentsAuthor.innerHTML = '<span class="nodebb-author"><img src="' + data.mainPost.user.picture + '" /> <a href="' + nbb.url + '/user/' + data.mainPost.user.userslug + '">' + data.mainPost.user.username + '</a></span>';
            }

            if (pagination) {
                html = normalizePost(parse(data, templates.blocks['posts']));
                commentsDiv.innerHTML = commentsDiv.innerHTML + html;
            } else {
                html = parse(data, data.template);
                nodebbDiv.innerHTML = normalizePost(html);

                if (data.mainPost) {
                    mainPost=data.mainPost;
                    onUpvoted(nodebbDiv.querySelector('.top-tool-box'), mainPost.upvoted, mainPost.votes);
                    onBookmarked(nodebbDiv.querySelector('.top-tool-box'), mainPost.bookmarked);
                }
            }

            contentDiv = document.getElementById('nodebb-content');

            setTimeout(function() {
                var lists = nodebbDiv.getElementsByTagName("li");
                for (var list in lists) {
                    if (lists.hasOwnProperty(list)) {
                        lists[list].className = '';
                    }
                }
            }, 100);

            if (savedText) {
                contentDiv.value = savedText;
            }

            if (data.tid) {
                var loadMore = document.getElementById('nodebb-load-more');
                loadMore.onclick = function() {
                    pagination++;
                    reloadComments();
                }
                if (data.posts.length) {
                    loadMore.style.display = 'inline-block';
                }

                if (pagination * 10 + data.posts.length + 1 >= data.postCount) {
                    loadMore.style.display = 'none';
                }

                if (typeof jQuery !== 'undefined' && jQuery() && jQuery().fitVids) {
                    jQuery(nodebbDiv).fitVids();
                }

                if (data.user && data.user.uid) {
                    var error = window.location.href.match(/error=[\S]*/);
                    if (error) {
                        if (error[0].indexOf('too-many-posts') !== -1) {
                            error = 'Please wait before posting so soon.';
                        } else if (error[0].indexOf('content-too-short') !== -1) {
                            error = 'Please post a longer reply.';
                        }

                        document.getElementById('nodebb-error').innerHTML = error;
                    }
                } else {
                    document.getElementById('nodebb-register').onclick = function() {
                        authenticate('register');
                    };

                    document.getElementById('nodebb-login').onclick = function() {
                        authenticate('login');
                    }
                }

                var bindOnClick = function(nodeList, handler) {
                    for (var i = nodeList.length - 1; i >= 0; i--) {
                      nodeList[i].onclick = handler;
                    }
                };

                var isInViewport = function(element) {
                   var rect = element.getBoundingClientRect();
                   return (
                       rect.top >= 0 && rect.left >= 0 &&
                       rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                       rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                   );
                };

                var nodebbCommentsList = nodebbDiv.querySelector('#nodebb-comments-list');
                bindOnClick(nodebbCommentsList.querySelectorAll('[component="post/parent"]'), function(event) {
                    var element = event.target;
                    var goTo = nodebbCommentsList.querySelector('.topic-item[data-pid="' + element.getAttribute('data-topid') + '"]');

                    if (!goTo) {
                        goTo = nodebbDiv.querySelector('#nodebb-load-more');
                    }

                    if (!isInViewport(goTo)) {
                        goTo.scrollIntoView(false);
                    }

                    goTo.classList.add('highlight');
                    element.classList.add('highlight');

                    setTimeout(function() {
                        goTo.classList.remove('highlight');
                        element.classList.remove('highlight');
                    }, 1000);

                });

                bindOnClick(nodebbDiv.querySelectorAll('[component="post/reply"],[component="post/quote"],[component="post/bookmark"],[component="post/upvote"]'), function(event) {
                    if (!data.user || !data.user.uid) {
                        authenticate('login');
                        return;
                    }

                    var topicItem = event.target;
                    var bookmarked = JSON.parse(this.getAttribute('data-bookmarked'));
                    var upvoted = JSON.parse(this.getAttribute('data-upvoted'));

                    while (topicItem && !topicItem.classList.contains('topic-item')) {
                        topicItem = topicItem.parentElement;
                    }

                    if (topicItem) {
                        var elementForm = topicItem.querySelector('form');
                        var visibleForm = nodebbCommentsList.querySelector('li .topic-item form:not(.hidden)');
                        var formInput = elementForm.querySelector('textarea');
                        var pid = topicItem.getAttribute('data-pid');
                        var uid = topicItem.getAttribute('data-uid');

                        if (visibleForm && visibleForm !== elementForm) {
                            visibleForm.classList.add('hidden');
                        }

                        if (/\/quote$/.test(this.getAttribute('component'))) {
                            var postBody = topicItem.querySelector('.post-content .post-body');
                            var quote = (postBody.innerText ? postBody.innerText : postBody.textContent).split('\n').map(function(line) { return line ? '> ' + line : line; }).join('\n');
                            formInput.value = '@' + topicItem.getAttribute('data-userslug') + ' said:\n' + quote + formInput.value;
                            elementForm.classList.remove('hidden');
                        } else if (/\/reply$/.test(this.getAttribute('component'))) {
                            formInput.value = '@' + topicItem.getAttribute('data-userslug') + ': ' + formInput.value;
                            elementForm.classList.remove('hidden');
                        } else if (/\/upvote$/.test(this.getAttribute('component'))) {
                            if(data.user.uid != uid) {
                                upvotePost(topicItem, pid, upvoted);
                            }
                        } else if (/\/bookmark$/.test(this.getAttribute('component'))) {
                            bookmarkPost(topicItem, pid, bookmarked);
                        }
                    } else {

                        if (/\/upvote$/.test(this.getAttribute('component'))) {
                            if(data.user.uid != mainPost.uid) {
                                upvotePost(nodebbDiv.querySelector('.top-tool-box'), mainPost.pid, upvoted);
                            }
                        } else if (/\/bookmark$/.test(this.getAttribute('component'))) {
                            bookmarkPost(nodebbDiv.querySelector('.top-tool-box'), mainPost.pid, bookmarked);
                        }
                    }

                });

            } else {
                if (data.isAdmin) {
                    var markdown, articleTitle;
                    if (nbb.articleContent) {
                        markdown = nbb.articleContent + '\n\n**Click [here]('+articlePath+') to see the full blog post**';
                    } else {
                        markdown = document.getElementById('nbb-markdown').innerText;
                        markdown = markdown.split('\n\n').slice(0,2).join('\n\n') + '\n\n**Click [here]('+articlePath+') to see the full blog post**';
                    }

                    if (nbb.articleTitle) {
                        articleTitle = nbb.articleTitle;
                    } else {
                        articleTitle = document.getElementById('nbb-title').innerText;
                    }

                    document.getElementById('nodebb-content-title').value = articleTitle;
                    document.getElementById('nodebb-content-markdown').value = markdown;
                    document.getElementById('nodebb-content-cid').value = nbb.cid || -1;
                    document.getElementById('nodebb-content-blogger').value = nbb.blogger;
                    document.getElementById('nodebb-content-tags').value = JSON.stringify(nbb.tags || '');
                }
            }
        }
    };

    function onUpvoted (topicItem, isUpvote, votes) {
        var el = topicItem.querySelector('.i-upvote');
        var link = topicItem.querySelector('[component="post/upvote"]');
        var countEl = topicItem.querySelector('.upvote-count');
        if (isUpvote) {
            el.classList.add('icon-thumbs-up-alt');
            el.classList.remove('icon-thumbs-up');
            link.setAttribute('data-upvoted', true);
            countEl.classList.remove('hidden');
            countEl.innerText = votes;
        } else {
            el.classList.remove('icon-thumbs-up-alt');
            el.classList.add('icon-thumbs-up');
            link.setAttribute('data-upvoted', false);
            if (votes == 0) {
                countEl.classList.add('hidden');
            }
            countEl.innerText = votes;
        }
    }

    voteXHR.onload = function () {
        voteXHR.isBusy = false;
        if (voteXHR.status >= 200 && voteXHR.status < 400) {
            var data = JSON.parse(voteXHR.responseText);
            if (data.error) {
                console.error(data.error);
            } else if (data.result) {
                onUpvoted(voteXHR.topicItem, voteXHR.isUpvote, data.result.post.votes);
            }
        }
    };

    function onBookmarked (topicItem, isBookmark) {
        var el = topicItem.querySelector('.i-bookmark');
        var link = topicItem.querySelector('[component="post/bookmark"]');
        if (isBookmark) {
            el.classList.add('icon-bookmark');
            el.classList.remove('icon-bookmark-empty');
            link.setAttribute('data-bookmarked', true);
        } else {
            el.classList.remove('icon-bookmark');
            el.classList.add('icon-bookmark-empty');
            link.setAttribute('data-bookmarked', false);
        }
    }
    bookmarkXHR.onload = function () {
        bookmarkXHR.isBusy = false;
        if (bookmarkXHR.status >= 200 && bookmarkXHR.status < 400) {
            var data = JSON.parse(bookmarkXHR.responseText);
            if (data.error) {
                console.error(data.error);
            } else {
                onBookmarked(bookmarkXHR.topicItem, bookmarkXHR.isBookmark);
            }
        }
    };

    function reloadComments() {
        xget(XHR, nbb.url + '/comments/get/' + (nbb.blogger || 'default') + '/' + nbb.articleID + '/' + pagination);
    }

    function upvotePost (topicItem, pid, upvoted) {
        if (voteXHR.isBusy) return;
        voteXHR.isBusy = true;
        voteXHR.topicItem = topicItem;
        voteXHR.isUpvote = !upvoted;
        xpost(voteXHR, nbb.url + '/comments/vote', {toPid: pid, isUpvote: !upvoted});
    }

    function bookmarkPost (topicItem, pid, bookmarked) {
        if (bookmarkXHR.isBusy) return;
        bookmarkXHR.isBusy = true;
        bookmarkXHR.topicItem = topicItem;
        bookmarkXHR.isBookmark = !bookmarked;
        xpost(bookmarkXHR, nbb.url + '/comments/bookmark', {toPid: pid, isBookmark: !bookmarked});
    }

    reloadComments();

    var templates = {blocks: {}};
    function parse (data, template) {
        function replace(key, value, template) {
            var searchRegex = new RegExp('{' + key + '}', 'g');
            return template.replace(searchRegex, value);
        }

        function makeRegex(block) {
            return new RegExp("<!--[\\s]*BEGIN " + block + "[\\s]*-->[\\s\\S]*<!--[\\s]*END " + block + "[\\s]*-->", 'g');
        }

        function makeConditionalRegex(block) {
            return new RegExp("<!--[\\s]*IF " + block + "[\\s]*-->([\\s\\S]*?)<!--[\\s]*ENDIF " + block + "[\\s]*-->", 'g');
        }

        function getBlock(regex, block, template) {
            data = template.match(regex);
            if (data == null) return;

            if (block !== undefined) templates.blocks[block] = data[0];

            var begin = new RegExp("(\r\n)*<!-- BEGIN " + block + " -->(\r\n)*", "g"),
                end = new RegExp("(\r\n)*<!-- END " + block + " -->(\r\n)*", "g"),

            data = data[0]
                .replace(begin, "")
                .replace(end, "");

            return data;
        }

        function setBlock(regex, block, template) {
            return template.replace(regex, block);
        }

        var regex, block;

        return (function parse(data, namespace, template, blockInfo) {
            if (!data || data.length == 0) {
                template = '';
            }

            function checkConditional(key, value) {
                var conditional = makeConditionalRegex(key),
                    matches = template.match(conditional);

                if (matches !== null) {
                    for (var i = 0, ii = matches.length; i < ii; i++) {
                        var conditionalBlock = matches[i].split(/<!-- ELSE -->/);

                        var statement = new RegExp("(<!--[\\s]*IF " + key + "[\\s]*-->)|(<!--[\\s]*ENDIF " + key + "[\\s]*-->)", 'gi');

                        if (conditionalBlock[1]) {
                            // there is an else statement
                            if (!value) {
                                template = template.replace(matches[i], conditionalBlock[1].replace(statement, ''));
                            } else {
                                template = template.replace(matches[i], conditionalBlock[0].replace(statement, ''));
                            }
                        } else {
                            // regular if statement
                            if (!value) {
                                template = template.replace(matches[i], '');
                            } else {
                                template = template.replace(matches[i], matches[i].replace(statement, ''));
                            }
                        }
                    }
                }
            }

            for (var d in data) {
                if (data.hasOwnProperty(d)) {
                    if (typeof data[d] === 'undefined') {
                        continue;
                    } else if (data[d] === null) {
                        template = replace(namespace + d, '', template);
                    } else if (data[d].constructor == Array) {
                        checkConditional(namespace + d + '.length', data[d].length);
                        checkConditional('!' + namespace + d + '.length', !data[d].length);

                        namespace += d + '.';

                        var regex = makeRegex(d),
                            block = getBlock(regex, namespace.substring(0, namespace.length - 1), template);

                        if (block == null) {
                            namespace = namespace.replace(d + '.', '');
                            continue;
                        }

                        var numblocks = data[d].length - 1,
                            i = 0,
                            result = "";

                        do {
                            result += parse(data[d][i], namespace, block, {iterator: i, total: numblocks});
                        } while (i++ < numblocks);

                        namespace = namespace.replace(d + '.', '');
                        template = setBlock(regex, result, template);
                    } else if (data[d] instanceof Object) {
                        template = parse(data[d], d + '.', template);
                    } else {
                        var key = namespace + d,
                            value = typeof data[d] === 'string' ? data[d].replace(/^\s+|\s+$/g, '') : data[d];

                        checkConditional(key, value);
                        checkConditional('!' + key, !value);

                        if (blockInfo && blockInfo.iterator) {
                            checkConditional('@first', blockInfo.iterator === 0);
                            checkConditional('!@first', blockInfo.iterator !== 0);
                            checkConditional('@last', blockInfo.iterator === blockInfo.total);
                            checkConditional('!@last', blockInfo.iterator !== blockInfo.total);
                        }

                        template = replace(key, value, template);
                    }
                }
            }

            if (namespace) {
                var regex = new RegExp("{" + namespace + "[\\s\\S]*?}", 'g');
                template = template.replace(regex, '');
                namespace = '';
            } else {
                // clean up all undefined conditionals
                template = template.replace(/<!-- ELSE -->/gi, 'ENDIF -->')
                                    .replace(/<!-- IF([^@]*?)ENDIF([^@]*?)-->/gi, '');
            }

            return template;

        })(data, "", template);
    }
};
